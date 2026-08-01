// OpenRouter로 오늘의 운세를 생성하는 서버 라우트.
// API 키는 서버에서만 읽으며 클라이언트로 노출되지 않는다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const SYSTEM = `너는 한국어 '오늘의 운세' 작가야. 반드시 아래 JSON 스키마에 맞는 JSON 객체 하나만 출력해. 다른 설명이나 코드펜스는 절대 넣지 마.
{
  "emoji": "운세 분위기를 나타내는 이모지 1개",
  "title": "8자 이내의 짧고 감각적인 운세 제목",
  "message": "60자 내외의 따뜻하고 구체적인 오늘의 조언 한두 문장",
  "score": 0부터 100 사이 정수(운세 지수),
  "item": "행운의 아이템 (한국어, 짧게)",
  "colorName": "행운의 색 이름 (한국어)",
  "colorHex": "그 색의 #RRGGBB 헥스코드",
  "number": 1부터 45 사이 정수,
  "initials": ["귀인의 성씨 초성 2개 (예: ㄱ, ㅅ)"]
}`;

export async function POST() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return Response.json(
      { error: "OPENROUTER_API_KEY가 설정되지 않았습니다. .env를 확인하세요." },
      { status: 500 }
    );
  }

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // HTTP 헤더 값은 ASCII만 허용 → 한글 금지
        "X-Title": "Daily Fortune",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: "오늘의 운세를 새로 하나 만들어줘. 매번 다르게, 창의적으로.",
          },
        ],
        response_format: { type: "json_object" },
        temperature: 1.0,
        max_tokens: 400,
      }),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return Response.json(
        { error: `OpenRouter 오류 (${r.status})`, detail },
        { status: 502 }
      );
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    return Response.json(normalize(safeParse(content)));
  } catch (e) {
    return Response.json(
      { error: "AI 운세 생성 실패", detail: String(e).slice(0, 300) },
      { status: 500 }
    );
  }
}

// 모델이 코드펜스 등을 섞어 보내도 첫 JSON 객체를 뽑아낸다.
function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    const m = String(s).match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        // 무시
      }
    }
    return {};
  }
}

// AI 응답을 카드가 기대하는 형태로 정규화 + 값 보정
function normalize(p) {
  const score = clampInt(p.score, 0, 100, 70);
  const number = clampInt(p.number, 1, 45, 7);

  // 모델이 "김" 같은 통글자로 줘도 초성(ㄱ)만 뽑아 라벨과 일치시킨다.
  let initials = Array.isArray(p.initials)
    ? p.initials.map(toChoseong).filter(Boolean).slice(0, 2)
    : [];
  if (initials.length < 2) initials = ["ㄱ", "ㅅ"];

  const hex = /^#[0-9a-fA-F]{6}$/.test(p.colorHex) ? p.colorHex : "#e8c07d";

  return {
    ai: true,
    fortune: {
      emoji: str(p.emoji, "🔮", 4),
      title: str(p.title, "오늘의 운세", 24),
      message: str(p.message, "오늘 하루도 좋은 일이 가득하길 바랍니다.", 200),
      score,
    },
    item: str(p.item, "따뜻한 차 한 잔", 40),
    color: { name: str(p.colorName, "골드", 20), hex },
    number,
    initials,
  };
}

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function str(v, fallback, max) {
  const s = (v ?? "").toString().trim();
  return (s || fallback).slice(0, max);
}

// "김" → "ㄱ", "ㅇ" → "ㅇ" 처럼 첫 글자의 초성을 반환 (아니면 null)
const LEADS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
function toChoseong(v) {
  const ch = (v ?? "").toString().trim()[0];
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return LEADS[Math.floor((code - 0xac00) / 588)];
  if (code >= 0x3131 && code <= 0x314e) return ch; // 이미 자모(초성)면 그대로
  return null;
}
