/* Fortune LLM proxy — AWS Lambda (Node.js 20+, ESM)
 *
 * Receives { kind: "saju" | "tarot", payload } from the GitHub Pages fortune
 * page and returns BOTH languages in one call so the page can switch KR/EN
 * without re-calling the API:
 *   saju  → { sections: { ko: {personality,wealth,love,forecast}, en: {...} } }
 *   tarot → { text: { ko, en } }
 * The API key stays in Lambda env vars and is never exposed to the browser.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  (required)
 *   MODEL              (optional, default "claude-opus-5")
 *   EFFORT             (optional, default "low" — readings are short creative text)
 *   ALLOWED_ORIGINS    (optional, comma-separated; default allows the GitHub Pages site)
 */

import Anthropic from "@anthropic-ai/sdk";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  BatchWriteCommand,
} from "@aws-sdk/lib-dynamodb"; // bundled in the nodejs Lambda runtime

// Fall back to a placeholder so the module never crashes at init when the
// key isn't set yet — requests then fail with 401 and return reading_failed,
// which the web page silently ignores.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "unset" });

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const HIST_TABLE = process.env.HIST_TABLE || "fortune-history";
const HIST_LIMIT = 30;

const MODEL = process.env.MODEL || "claude-opus-5";
const EFFORT = process.env.EFFORT || "low";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://rpgxp13.github.io,http://localhost:8940")
  .split(",")
  .map((s) => s.trim());

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  };
}

const SAJU_SYSTEM = `너는 따뜻하고 통찰력 있는 사주 상담가야. 주어진 사주 정보(사주원국, 오행/음양 분포, 대운, 올해·이번 달 간지)를 바탕으로 다섯 개 섹션의 상세 풀이를 JSON으로 작성해.
결과는 반드시 한국어(ko)와 영어(en) 두 버전을 모두 담아야 해 — 같은 풀이를 두 언어로 자연스럽게 쓰되, 직역 번역투가 아니라 각 언어에서 자연스러운 문장으로.

각 섹션 내용:
- personality (성격 및 적성): 일간·오행·음양 조합이 보여주는 성격의 깊은 결과 잘 맞는 일의 방향. 3~4문장
- wealth (재물운): 재성의 상태와 돈을 대하는 스타일, 재물을 키우는 실용적 조언. 대운 흐름이 있으면 반영. 3~4문장
- love (애정 및 궁합): 연애 스타일, 배우자궁(일지)이 말해주는 것, 잘 맞는 상대의 기운. 3~4문장
- forecast (연간·월간 운세): 올해 간지와 이번 달 간지가 일간과 만나 만드는 흐름, 이 시기에 하면 좋은 것. 3~4문장
- overall (총평): 위 네 섹션을 관통하는 종합 총평. 이 사주의 가장 큰 강점 하나와 지금 이 사람에게 건네고 싶은 핵심 조언으로 마무리. 4~5문장

공통 규칙:
- ko는 존댓말, en은 warm하고 자연스러운 영어. 다정하고 희망적인 어조. 재미와 자기 성찰을 위한 콘텐츠
- 단정적 예언, 건강/법률/투자에 대한 구체적 지시 금지. "~한 기운이 있어요", "~해보면 좋겠어요" 식으로
- 시주가 없으면(삼주) 자연스럽게 반영하되 그 언급으로 시작하지 말 것
- 각 섹션은 헤더 없이 본문만`;

const SAJU_KEYS = ["personality", "wealth", "love", "forecast", "overall"];

/* API Gateway hard-caps integrations at 30s, and generating all five
   sections in both languages blows past it — so the page requests sections
   in small parallel batches (payload.sections) and each call gets a schema
   restricted to just the requested keys */
function sajuSchema(keys) {
  const props = {};
  for (const k of keys) props[k] = { type: "string" };
  const loc = { type: "object", properties: props, required: keys, additionalProperties: false };
  return { type: "object", properties: { ko: loc, en: loc }, required: ["ko", "en"], additionalProperties: false };
}

const TAROT_SYSTEM = `너는 따뜻하고 통찰력 있는 타로 리더야. 주어진 카드 한 장(정/역방향, 스프레드 내 포지션, 질문 주제)에 대한 상세 해석을 JSON으로 써줘.
결과는 반드시 한국어(ko)와 영어(en) 두 버전을 모두 담아야 해 — 같은 해석을 두 언어로 자연스럽게 쓰되, 직역 번역투가 아니라 각 언어에서 자연스러운 문장으로.

규칙:
- ko는 존댓말, en은 warm하고 자연스러운 영어. 재미와 자기 성찰을 위한 콘텐츠임을 전제로 함
- 카드의 상징 → 이 포지션에서의 의미 → 주제에 맞춘 구체적이고 부드러운 조언, 3~5문장으로 자연스럽게 연결
- 역방향이면 그 뉘앙스를 반영하되 겁주지 말 것. 단정적 예언 금지
- ko는 200~350자, en은 60~110단어, 각각 한 문단`;

const TAROT_SCHEMA = {
  type: "object",
  properties: { ko: { type: "string" }, en: { type: "string" } },
  required: ["ko", "en"],
  additionalProperties: false,
};

const TAROT_OVERALL_SYSTEM = `너는 따뜻하고 통찰력 있는 타로 리더야. 한 스프레드에서 뽑힌 카드 전체를 종합한 총평을 JSON으로 써줘.
결과는 반드시 한국어(ko)와 영어(en) 두 버전을 모두 담아야 해 — 같은 총평을 두 언어로 자연스럽게 쓰되, 직역 번역투가 아니라 각 언어에서 자연스러운 문장으로.

규칙:
- ko는 존댓말, en은 warm하고 자연스러운 영어. 재미와 자기 성찰을 위한 콘텐츠임을 전제로 함
- 카드를 하나씩 나열하지 말고, 카드들이 서로 이어져 만드는 하나의 흐름/이야기로 종합할 것
- 질문 주제에 맞춘 핵심 조언 한두 가지로 마무리
- 겁주지 말 것, 단정적 예언 금지
- ko는 250~450자, en은 80~140단어, 한두 문단`;

function buildSajuPrompt(payload) {
  const p = payload.pillars || {};
  const lines = [
    `Year pillar: ${p.year}`,
    `Month pillar: ${p.month}`,
    `Day pillar: ${p.day}`,
    `Hour pillar: ${p.time || "(unknown — three-pillar chart)"}`,
    `Five-element counts (wood/fire/earth/metal/water): ${JSON.stringify(payload.counts)}`,
  ];
  if (payload.yinYang) lines.push(`Yin-yang counts: yang ${payload.yinYang.yang}, yin ${payload.yinYang.yin}`);
  if (payload.daeun && payload.daeun.length) {
    lines.push(`10-year luck cycles (start age / gan-zhi): ${payload.daeun.map((d) => `${d.a}/${d.gz}`).join(", ")}`);
  }
  if (payload.current) {
    lines.push(`This year's gan-zhi: ${payload.current.yearGZ}, this month's gan-zhi: ${payload.current.monthGZ}`);
  }
  if (payload.name) lines.push(`Name: ${payload.name}`);
  if (payload.gender) lines.push(`Gender: ${payload.gender === "F" ? "female" : "male"}`);
  if (payload.birth) lines.push(`Birth info: ${payload.birth}`);
  const keys = sajuKeys(payload);
  if (keys.length < SAJU_KEYS.length) {
    lines.push(`이번 요청에서는 다음 섹션만 작성해: ${keys.join(", ")}`);
  }
  lines.push("ko(한국어)와 en(영어) 두 버전을 모두 작성해줘.");
  return lines.join("\n");
}

function sajuKeys(payload) {
  const req = Array.isArray(payload.sections)
    ? payload.sections.filter((k) => SAJU_KEYS.includes(k))
    : [];
  return req.length ? req : SAJU_KEYS;
}

const topicLabel = { love: "love/relationship", work: "work/career", money: "money", all: "general" };

function buildTarotPrompt(payload) {
  const c = payload.card || {};
  const lines = [
    `Card: ${c.en} (${c.ko})`,
    `Arcana: ${c.arcana}${c.suit ? `, suit: ${c.suit}` : ""}`,
    `Orientation: ${payload.reversed ? "REVERSED" : "upright"}`,
    `Spread: ${payload.spread}, position: ${payload.position}`,
    `Question topic: ${topicLabel[payload.topic] || payload.topic}`,
    "ko(한국어)와 en(영어) 두 버전을 모두 작성해줘.",
  ];
  return lines.join("\n");
}

function buildTarotOverallPrompt(payload) {
  const lines = [
    `Spread: ${payload.spread}`,
    `Question topic: ${topicLabel[payload.topic] || payload.topic}`,
    "Cards drawn (position — card, orientation):",
    ...(payload.cards || []).map(
      (c) => `- ${c.position}: ${c.en} (${c.ko}), ${c.reversed ? "REVERSED" : "upright"}`
    ),
    "ko(한국어)와 en(영어) 두 버전을 모두 작성해줘.",
  ];
  return lines.join("\n");
}

export const handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const headers = corsHeaders(origin);
  const method = event.requestContext?.http?.method || event.httpMethod || "POST";

  if (method === "OPTIONS") {
    return { statusCode: 204, headers };
  }
  if (method !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "method_not_allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_json" }) };
  }

  const { kind, payload } = body;
  // hist_delete / hist_clear disabled for now (deletion feature commented out)
  const KINDS = ["saju", "tarot", "tarot_overall", "hist_list", "hist_put"];
  const isHist = typeof kind === "string" && kind.startsWith("hist_");
  const maxBody = isHist ? 200000 : 20000; // history entries carry full bilingual AI text
  if (!KINDS.includes(kind) || !payload || (event.body || "").length > maxBody) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_request" }) };
  }

  /* ── shared history (DynamoDB) — lets both devices see the same records ── */
  if (isHist) {
    const space = payload.space;
    if (typeof space !== "string" || !space || space.length > 64) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_space" }) };
    }
    try {
      if (kind === "hist_list") {
        const q = await ddb.send(new QueryCommand({
          TableName: HIST_TABLE,
          KeyConditionExpression: "#s = :s",
          ExpressionAttributeNames: { "#s": "space" },
          ExpressionAttributeValues: { ":s": space },
          ScanIndexForward: false, // newest first
          Limit: HIST_LIMIT,
        }));
        return { statusCode: 200, headers, body: JSON.stringify({ items: (q.Items || []).map((it) => it.entry) }) };
      }
      if (kind === "hist_put") {
        const entry = payload.entry;
        if (!entry || typeof entry.ts !== "number" || typeof entry.type !== "string") {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_entry" }) };
        }
        await ddb.send(new PutCommand({ TableName: HIST_TABLE, Item: { space, ts: entry.ts, entry } }));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
      /* ── deletion disabled (kept for later) ──
      if (kind === "hist_delete") {
        if (typeof payload.ts !== "number") {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_entry" }) };
        }
        await ddb.send(new DeleteCommand({ TableName: HIST_TABLE, Key: { space, ts: payload.ts } }));
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
      }
      // hist_clear: query keys and batch-delete (25 per batch)
      let keys = [];
      let lastKey;
      do {
        const q = await ddb.send(new QueryCommand({
          TableName: HIST_TABLE,
          KeyConditionExpression: "#s = :s",
          ExpressionAttributeNames: { "#s": "space", "#t": "ts" },
          ExpressionAttributeValues: { ":s": space },
          ProjectionExpression: "#s, #t",
          ExclusiveStartKey: lastKey,
        }));
        keys = keys.concat((q.Items || []).map((it) => ({ space: it.space, ts: it.ts })));
        lastKey = q.LastEvaluatedKey;
      } while (lastKey);
      for (let i = 0; i < keys.length; i += 25) {
        await ddb.send(new BatchWriteCommand({
          RequestItems: { [HIST_TABLE]: keys.slice(i, i + 25).map((k) => ({ DeleteRequest: { Key: k } })) },
        }));
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, deleted: keys.length }) };
      */
      return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_request" }) };
    } catch (err) {
      console.error("history error:", err?.message);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "history_failed" }) };
    }
  }

  const system = kind === "saju" ? SAJU_SYSTEM : kind === "tarot_overall" ? TAROT_OVERALL_SYSTEM : TAROT_SYSTEM;
  const prompt = kind === "saju" ? buildSajuPrompt(payload)
    : kind === "tarot_overall" ? buildTarotOverallPrompt(payload)
    : buildTarotPrompt(payload);
  const schema = kind === "saju" ? sajuSchema(sajuKeys(payload)) : TAROT_SCHEMA;

  try {
    const request = {
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: EFFORT, format: { type: "json_schema", schema } },
      system,
      messages: [{ role: "user", content: prompt }],
    };

    const response = await client.messages.create(request);

    if (response.stop_reason === "refusal") {
      return { statusCode: 200, headers, body: JSON.stringify({ text: null }) };
    }

    const raw = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const brify = (s) => (s || "").trim().replace(/\n/g, "<br>");
    const parsed = JSON.parse(raw);

    if (kind === "saju") {
      for (const lng of ["ko", "en"]) {
        for (const k of Object.keys(parsed[lng] || {})) parsed[lng][k] = brify(parsed[lng][k]);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ sections: parsed }) };
    }
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ text: { ko: brify(parsed.ko), en: brify(parsed.en) } }),
    };
  } catch (err) {
    console.error("claude api error:", err?.status, err?.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "reading_failed" }) };
  }
};
