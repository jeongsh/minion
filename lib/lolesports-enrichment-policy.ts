const ENRICHMENT_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function enrichmentRetryWindowStart(now: Date) {
  return new Date(now.getTime() - ENRICHMENT_RETRY_WINDOW_MS).toISOString();
}
