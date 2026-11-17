export function calendarMonthRange(rawMonth?: string | null) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date());
  const monthKey = rawMonth && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today;
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const fromDay = new Date(first);
  fromDay.setUTCDate(1 - first.getUTCDay());
  const toDay = new Date(fromDay);
  toDay.setUTCDate(fromDay.getUTCDate() + 42);
  const eventFrom = new Date(fromDay);
  eventFrom.setUTCDate(fromDay.getUTCDate() - 6);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  return {
    monthKey, from: new Date(key(fromDay) + "T00:00:00+09:00").toISOString(),
    to: new Date(key(toDay) + "T00:00:00+09:00").toISOString(),
    eventRange: { from: key(eventFrom), to: key(toDay) },
  };
}
