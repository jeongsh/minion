// 대문(헤더) 선정은 운영진 수동 적용이라 자동 배치가 없다.
// 다만 fan_header_selections 가 (team_id, week_start) 로 묶여 있어 주차 계산은 남는다.

/** KST 기준 그 주 월요일을 YYYY-MM-DD로 반환한다. */
export function kstWeekStart(at: Date = new Date()): string {
  // UTC+9로 옮긴 뒤 UTC 날짜 함수를 쓰면 서버 타임존에 의존하지 않는다.
  const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일
  const backToMonday = day === 0 ? 6 : day - 1;
  kst.setUTCDate(kst.getUTCDate() - backToMonday);
  return kst.toISOString().slice(0, 10);
}
