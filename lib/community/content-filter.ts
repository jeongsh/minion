// 커뮤니티 금칙어(쌍욕) 필터 — 글/댓글 작성·수정 시점에 동기로 검사한다.
//
// 설계 원칙: 정밀도 우선. 오탐(정상 글 차단)이 미탐(욕설 통과)보다 사용자 경험에 훨씬 나쁘므로
// 명백한 쌍욕만 목록에 올린다. 여기서 새는 표현은 2차 방어(신고 누적 자동 블라인드)가 잡는다.
//
// 우회 표기 대응:
// - "씨1발", "씨.발", "씨-발" → 한글/자모/영문/공백 외 문자를 제거한 뒤 매칭해서 잡는다.
// - "씨 발"(띄어쓰기 우회)은 일부러 잡지 않는다 — 공백까지 제거하면 "다시 발표" 같은
//   정상 문장이 오탐되기 때문. 이런 케이스는 신고 누적 블라인드에 맡긴다.
//
// 목록은 운영하면서 자유롭게 추가/삭제한다. 단어를 추가할 때는 반드시
// "이 문자열을 부분 문자열로 포함하는 정상 단어가 있는가"를 먼저 생각할 것.
// (예: "시발"은 출시발표/다시발송 오탐 위험이 있어 BOUNDED 목록에서 왼쪽 경계를 검사한다.)

/** 금칙어보다 먼저 제거하는 예외 단어(정상 단어인데 금칙어를 포함하는 경우). */
export const PROFANITY_EXCEPTIONS: string[] = [
  "시발점",
  "시발역",
  "시발주자",
  "시발자",
];

/** 부분 문자열 매칭 금칙어. 어디에 등장하든 차단. */
export const PROFANITY_WORDS: string[] = [
  "씨발",
  "씨팔",
  "씨빨",
  "시팔",
  "쓰발",
  "슈발",
  "개새끼",
  "개새키",
  "개색기",
  "개색끼",
  "개세끼",
  "병신",
  "븅신",
  "빙신",
  "지랄",
  "좆",
  "니애미",
  "니에미",
  "느금마",
  "니미럴",
  "앰창",
  "썅",
  "염병",
  "옘병",
  "쌍년",
  "쌍놈",
];

/**
 * 왼쪽에 다른 한글이 붙으면 매칭하지 않는 금칙어.
 * "시발"은 단독/문두에서는 욕이지만 "출시발표", "다시발송"처럼
 * 앞말에 붙어 등장하는 정상 조합이 많아 경계를 검사한다.
 */
export const PROFANITY_WORDS_BOUNDED: string[] = ["시발"];

function normalizeForFilter(text: string): string {
  // NFC 사용: NFKC 는 호환 자모(ㅅㅂ 등)를 조합형 자모로 바꿔 아래 필터 범위를 벗어나게 만든다.
  // 전각 숫자·기호 등 NFKC 가 접던 문자들은 어차피 아래 replace 에서 제거된다.
  let normalized = text.normalize("NFC").toLowerCase();

  // 예외 단어를 공백으로 치환해 금칙어 매칭에서 제외한다.
  for (const exception of PROFANITY_EXCEPTIONS) {
    normalized = normalized.split(exception).join(" ");
  }

  // 한글 음절/자모/영문/공백만 남긴다 → 숫자·기호 끼워넣기 우회를 무력화.
  normalized = normalized.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z\s]/g, "");
  return normalized.replace(/\s+/g, " ");
}

/** 텍스트에서 첫 번째 금칙어를 찾는다. 없으면 null. */
export function findProfanity(text: string): string | null {
  const normalized = normalizeForFilter(text);

  for (const word of PROFANITY_WORDS) {
    if (normalized.includes(word)) return word;
  }
  for (const word of PROFANITY_WORDS_BOUNDED) {
    if (new RegExp(`(?<![가-힣])${word}`).test(normalized)) return word;
  }
  return null;
}

/** 에러 메시지 노출용 마스킹("씨발" → "씨*"). 금칙어를 그대로 되돌려주지 않는다. */
export function maskProfanity(word: string): string {
  return word.length <= 1 ? word : word[0] + "*".repeat(word.length - 1);
}
