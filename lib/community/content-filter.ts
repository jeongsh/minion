// 커뮤니티 금칙어(쌍욕) 필터.
// 2026-09-16 정책 변경으로 실제 작성/조회 경로에서는 호출하지 않는다.
// 욕설 차단을 다시 도입할 때 기존 호출부의 "욕설 필터 비활성화" 주석을 함께 복구한다.

export const PROFANITY_EXCEPTIONS: string[] = ["시발점", "시발역", "시발주자", "시발자"];

export const PROFANITY_WORDS: string[] = [
  "씨발", "씨팔", "씨빨", "시팔", "쓰발", "슈발", "개새끼", "개새키", "개색기", "개색끼",
  "개세끼", "병신", "븅신", "빙신", "지랄", "좆", "니애미", "니에미", "느금마", "니미럴",
  "앰창", "썅", "염병", "옘병", "쌍년", "쌍놈",
];

export const PROFANITY_WORDS_BOUNDED: string[] = ["시발"];

function normalizeForFilter(text: string): string {
  let normalized = text.normalize("NFC").toLowerCase();
  for (const exception of PROFANITY_EXCEPTIONS) normalized = normalized.split(exception).join(" ");
  normalized = normalized.replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z\s]/g, "");
  return normalized.replace(/\s+/g, " ");
}

export function findProfanity(text: string): string | null {
  const normalized = normalizeForFilter(text);
  for (const word of PROFANITY_WORDS) if (normalized.includes(word)) return word;
  for (const word of PROFANITY_WORDS_BOUNDED) {
    if (new RegExp(`(?<![가-힣])${word}`).test(normalized)) return word;
  }
  return null;
}

export function maskProfanity(word: string): string {
  return word.length <= 1 ? word : word[0] + "*".repeat(word.length - 1);
}
