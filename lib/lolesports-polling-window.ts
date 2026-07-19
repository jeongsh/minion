export const LOLESPORTS_POLLING_LEAD_TIME_MS = 30 * 60 * 1000;

type ScheduledMatch = {
  match_date: string;
};

export function getLolesportsPollingStartsAt(matches: ScheduledMatch[]) {
  const timestamps = matches
    .map((match) => new Date(match.match_date).getTime())
    .filter(Number.isFinite);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps) - LOLESPORTS_POLLING_LEAD_TIME_MS);
}

export function shouldPollLolesportsEvents(matches: ScheduledMatch[], now: Date = new Date()) {
  const startsAt = getLolesportsPollingStartsAt(matches);
  return startsAt !== null && now.getTime() >= startsAt.getTime();
}
