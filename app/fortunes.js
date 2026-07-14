export const fortunes = [
  {
    emoji: "🌞",
    title: "찬란한 하루",
    message: "미뤄두었던 일이 오늘 술술 풀립니다. 망설였던 연락을 먼저 건네보세요.",
    score: 95,
  },
  {
    emoji: "🍀",
    title: "뜻밖의 행운",
    message: "기대하지 않았던 곳에서 좋은 소식이 옵니다. 작은 제안도 흘려듣지 마세요.",
    score: 88,
  },
  {
    emoji: "🌊",
    title: "흐름을 타는 날",
    message: "억지로 밀어붙이기보다 상황에 몸을 맡기면 오히려 순조롭습니다.",
    score: 74,
  },
  {
    emoji: "🔥",
    title: "열정의 불씨",
    message: "당신의 에너지가 주변까지 물들입니다. 새로운 시작에 더없이 좋은 날.",
    score: 91,
  },
  {
    emoji: "🌙",
    title: "고요한 재정비",
    message: "오늘은 나서기보다 정리하는 날. 쉬는 것도 훌륭한 전진입니다.",
    score: 62,
  },
  {
    emoji: "💎",
    title: "숨은 가치 발견",
    message: "익숙하던 것에서 새로운 가능성을 봅니다. 사소한 디테일을 눈여겨보세요.",
    score: 83,
  },
  {
    emoji: "🦋",
    title: "변화의 조짐",
    message: "작은 선택 하나가 흐름을 바꿉니다. 평소와 다른 길로 걸어보세요.",
    score: 79,
  },
  {
    emoji: "☔",
    title: "잠시 흐림",
    message: "예상 밖의 지연이 있을 수 있지만 오래가지 않습니다. 서두르지 마세요.",
    score: 55,
  },
  {
    emoji: "🎁",
    title: "받는 기쁨",
    message: "누군가의 호의가 찾아옵니다. 감사 인사를 아끼지 마세요.",
    score: 86,
  },
  {
    emoji: "⛰️",
    title: "묵직한 성취",
    message: "더디지만 확실하게 나아가는 날. 오늘의 한 걸음이 나중에 크게 남습니다.",
    score: 71,
  },
  {
    emoji: "✨",
    title: "주목받는 순간",
    message: "당신의 노력이 드디어 눈에 띕니다. 겸손하되 움츠러들지는 마세요.",
    score: 93,
  },
  {
    emoji: "🌱",
    title: "새싹이 트는 날",
    message: "당장 결과는 없어도 씨앗은 심어집니다. 배움에 시간을 쓰기 좋은 날.",
    score: 68,
  },
];

export const luckyItems = [
  "따뜻한 아메리카노",
  "빨간 양말",
  "손목시계",
  "귀여운 열쇠고리",
  "새로 산 볼펜",
  "민트향 껌",
  "노란 우산",
  "낡은 책 한 권",
  "은색 반지",
  "화분 속 작은 식물",
  "가죽 지갑",
  "블루투스 이어폰",
  "직접 쓴 메모지",
  "초콜릿 한 조각",
  "동전 하나",
];

export const luckyColors = [
  { name: "코랄 핑크", hex: "#FF7A85" },
  { name: "딥 네이비", hex: "#2C3E70" },
  { name: "민트 그린", hex: "#4FD1A5" },
  { name: "머스터드 옐로", hex: "#F2C14E" },
  { name: "라벤더", hex: "#B39DDB" },
  { name: "테라코타", hex: "#C96F4A" },
  { name: "아이보리", hex: "#F0E6D2" },
  { name: "포레스트 그린", hex: "#3E6B4F" },
];

// 귀인의 성씨 초성 후보 (실제 한국 성씨에 쓰이는 초성만)
export const initials = [
  "ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ", "ㅂ", "ㅅ", "ㅇ", "ㅈ", "ㅊ", "ㅍ", "ㅎ",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 서로 다른 초성 2개를 뽑는다
function drawInitials() {
  const first = pick(initials);
  const rest = initials.filter((c) => c !== first);
  return [first, pick(rest)];
}

export function drawFortune() {
  return {
    fortune: pick(fortunes),
    item: pick(luckyItems),
    color: pick(luckyColors),
    number: Math.floor(Math.random() * 45) + 1,
    initials: drawInitials(),
  };
}
