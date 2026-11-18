const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function attendanceDate(now = Date.now()): string {
  return new Date(now + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function millisecondsUntilNextAttendanceDay(now = Date.now()): number {
  return DAY_MS - ((now + KST_OFFSET_MS) % DAY_MS);
}
