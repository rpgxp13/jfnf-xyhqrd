/* Fortune LLM proxy — AWS Lambda (Node.js 20+, ESM)
 *
 * Receives { kind: "saju" | "tarot", lang: "ko" | "en", payload } from the
 * GitHub Pages fortune page and returns { text } — a detailed reading
 * generated with the Claude API. The API key stays in Lambda env vars and
 * is never exposed to the browser.
 *
 * Env vars:
 *   ANTHROPIC_API_KEY  (required)
 *   MODEL              (optional, default "claude-opus-5")
 *   EFFORT             (optional, default "low" — readings are short creative text)
 *   ALLOWED_ORIGINS    (optional, comma-separated; default allows the GitHub Pages site)
 */

import Anthropic from "@anthropic-ai/sdk";

// Fall back to a placeholder so the module never crashes at init when the
// key isn't set yet — requests then fail with 401 and return reading_failed,
// which the web page silently ignores.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "unset" });

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

const SAJU_SYSTEM = {
  ko: `너는 따뜻하고 통찰력 있는 사주 상담가야. 주어진 사주 정보(사주원국, 오행/음양 분포, 대운, 올해·이번 달 간지)를 바탕으로 네 개 섹션의 상세 풀이를 JSON으로 작성해.

각 섹션 내용:
- personality (성격 및 적성): 일간·오행·음양 조합이 보여주는 성격의 깊은 결과 잘 맞는 일의 방향. 3~4문장
- wealth (재물운): 재성의 상태와 돈을 대하는 스타일, 재물을 키우는 실용적 조언. 대운 흐름이 있으면 반영. 3~4문장
- love (애정 및 궁합): 연애 스타일, 배우자궁(일지)이 말해주는 것, 잘 맞는 상대의 기운. 3~4문장
- forecast (연간·월간 운세): 올해 간지와 이번 달 간지가 일간과 만나 만드는 흐름, 이 시기에 하면 좋은 것. 3~4문장

공통 규칙:
- 존댓말, 다정하고 희망적인 어조. 재미와 자기 성찰을 위한 콘텐츠
- 단정적 예언, 건강/법률/투자에 대한 구체적 지시 금지. "~한 기운이 있어요", "~해보면 좋겠어요" 식으로
- 시주가 없으면(삼주) 자연스럽게 반영하되 그 언급으로 시작하지 말 것
- 각 섹션은 헤더 없이 본문만`,
  en: `You are a warm, insightful saju (Four Pillars) reader. From the given chart (pillars, five-element and yin-yang counts, 10-year luck cycles, this year's and month's gan-zhi), write a detailed reading as JSON with four sections.

Section contents:
- personality: the deeper texture of character shown by the day master, elements, and yin-yang mix, plus fitting work directions. 3-4 sentences
- wealth: the state of the wealth element, their money style, practical advice for growing it (reflect the luck cycles if given). 3-4 sentences
- love: their style in love, what the spouse seat (day branch) suggests, the kind of energy that suits them. 3-4 sentences
- forecast: the currents created as this year's and this month's gan-zhi meet the day master, and what suits this season. 3-4 sentences

Common rules:
- Warm, hopeful tone. Content for fun and self-reflection.
- No deterministic predictions; no specific health/legal/investment directives. Use "there's an energy of…", "you might try…"
- If the hour pillar is missing (three pillars), reflect it naturally without opening with it
- Body text only per section, no headers`,
};

const SAJU_SCHEMA = {
  type: "object",
  properties: {
    personality: { type: "string" },
    wealth: { type: "string" },
    love: { type: "string" },
    forecast: { type: "string" },
  },
  required: ["personality", "wealth", "love", "forecast"],
  additionalProperties: false,
};

const TAROT_SYSTEM = {
  ko: `너는 따뜻하고 통찰력 있는 타로 리더야. 주어진 카드 한 장(정/역방향, 스프레드 내 포지션, 질문 주제)에 대한 상세 해석을 써줘.

규칙:
- 존댓말, 다정한 어조. 재미와 자기 성찰을 위한 콘텐츠임을 전제로 함
- 카드의 상징 → 이 포지션에서의 의미 → 주제에 맞춘 구체적이고 부드러운 조언, 3~5문장으로 자연스럽게 연결
- 역방향이면 그 뉘앙스를 반영하되 겁주지 말 것. 단정적 예언 금지
- 전체 200~350자, 한 문단`,
  en: `You are a warm, insightful tarot reader. Write a detailed interpretation for one drawn card (orientation, spread position, question topic).

Rules:
- Warm tone. This is content for fun and self-reflection.
- Flow naturally in 3-5 sentences: the card's symbolism → what it means in this position → gentle, concrete advice for the topic
- If reversed, reflect that nuance without being scary. No deterministic predictions
- 60-110 words, one paragraph`,
};

function buildSajuPrompt(payload, lang) {
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
  lines.push(lang === "ko" ? "한국어로 작성해줘." : "Write in English.");
  return lines.join("\n");
}

function buildTarotPrompt(payload, lang) {
  const c = payload.card || {};
  const topicLabel = { love: "love/relationship", work: "work/career", money: "money", all: "general" };
  const lines = [
    `Card: ${c.en} (${c.ko})`,
    `Arcana: ${c.arcana}${c.suit ? `, suit: ${c.suit}` : ""}`,
    `Orientation: ${payload.reversed ? "REVERSED" : "upright"}`,
    `Spread: ${payload.spread}, position: ${payload.position}`,
    `Question topic: ${topicLabel[payload.topic] || payload.topic}`,
    lang === "ko" ? "한국어로 작성해줘." : "Write in English.",
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

  const { kind, lang, payload } = body;
  if (!["saju", "tarot"].includes(kind) || !payload || (event.body || "").length > 20000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "invalid_request" }) };
  }
  const lng = lang === "en" ? "en" : "ko";

  const system = kind === "saju" ? SAJU_SYSTEM[lng] : TAROT_SYSTEM[lng];
  const prompt = kind === "saju" ? buildSajuPrompt(payload, lng) : buildTarotPrompt(payload, lng);

  try {
    const request = {
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: EFFORT },
      system,
      messages: [{ role: "user", content: prompt }],
    };
    if (kind === "saju") {
      request.output_config.format = { type: "json_schema", schema: SAJU_SCHEMA };
    }

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

    if (kind === "saju") {
      const sections = JSON.parse(raw);
      for (const k of Object.keys(sections)) sections[k] = brify(sections[k]);
      return { statusCode: 200, headers, body: JSON.stringify({ sections }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ text: brify(raw) }) };
  } catch (err) {
    console.error("claude api error:", err?.status, err?.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "reading_failed" }) };
  }
};
