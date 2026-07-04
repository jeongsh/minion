const SOURCE_RETRY_DELAY_MS = 5 * 60 * 1000;
const RATE_LIMIT_RETRY_DELAY_MS = 10 * 60 * 1000;

export function leaguepediaRetryAt(
  now: Date,
  status: "waiting_for_source" | "failed" | "rate_limited",
) {
  const delay = status === "rate_limited"
    ? RATE_LIMIT_RETRY_DELAY_MS
    : SOURCE_RETRY_DELAY_MS;
  return new Date(now.getTime() + delay).toISOString();
}
