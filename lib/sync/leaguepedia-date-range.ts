import type { LeaguepediaSyncDateRange } from "./leaguepedia-lck-2026.ts";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 31;

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("날짜는 YYYY-MM-DD 형식으로 입력해주세요.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const parsed = new Date(utcMidnight);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("올바른 날짜를 입력해주세요.");
  }

  return utcMidnight;
}

export function leaguepediaKstDateRange(
  startDate: string,
  endDate: string,
): LeaguepediaSyncDateRange {
  const startDay = parseCalendarDate(startDate);
  const endDay = parseCalendarDate(endDate);

  if (endDay < startDay) {
    throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  }

  const rangeDays = Math.floor((endDay - startDay) / (24 * 60 * 60 * 1000)) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    throw new Error(`기간 동기화는 최대 ${MAX_RANGE_DAYS}일까지 선택할 수 있습니다.`);
  }

  return {
    startIso: new Date(startDay - KST_OFFSET_MS).toISOString(),
    endExclusiveIso: new Date(endDay + 24 * 60 * 60 * 1000 - KST_OFFSET_MS).toISOString(),
  };
}
