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

const client = new Anthropic();

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
  ko: `너는 따뜻하고 통찰력 있는 사주 상담가야. 주어진 사주 정보(년/월/일/시주, 오행 분포)를 바탕으로 상세 풀이를 써줘.

규칙:
- 존댓말, 다정하고 희망적인 어조. 재미와 자기 성찰을 위한 콘텐츠임을 전제로 함
- 3개 문단: ① 일간과 오행 조합이 보여주는 성격의 깊은 결 ② 관계와 애정에서의 스타일 ③ 지금 시기에 어울리는 조언
- 단정적 예언, 건강/법률/금전에 대한 구체적 지시는 금지. "~한 기운이 있어요", "~해보면 좋겠어요" 식으로
- 시주가 없으면(삼주) 그 점을 자연스럽게 반영하되 언급으로 시작하지 말 것
- 전체 400~600자, 문단 사이는 빈 줄 하나`,
  en: `You are a warm, insightful saju (Four Pillars) reader. Write a detailed reading from the given chart (year/month/day/hour pillars, five-element counts).

Rules:
- Warm, hopeful tone. This is content for fun and self-reflection.
- 3 paragraphs: (1) the deeper texture of personality shown by the day master and element mix (2) style in love and relationships (3) advice suited to this season of life
- No deterministic predictions; no specific health/legal/financial directives. Use "there's an energy of…", "you might try…"
- If the hour pillar is missing (three-pillar chart), reflect that naturally without opening with it
- 120-180 words total, one blank line between paragraphs`,
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
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: EFFORT },
      system,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      return { statusCode: 200, headers, body: JSON.stringify({ text: null }) };
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
      .replace(/\n/g, "<br>");

    return { statusCode: 200, headers, body: JSON.stringify({ text }) };
  } catch (err) {
    console.error("claude api error:", err?.status, err?.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: "reading_failed" }) };
  }
};
