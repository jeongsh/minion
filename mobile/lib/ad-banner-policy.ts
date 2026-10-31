type BannerFailure = { placement: string; code: string; at: string };
const failures: BannerFailure[] = [];
const nextRequests = new Map<string, number>();
const BANNER_REQUEST_INTERVAL_MS = 60_000;
const unfilledPlacements = new Set<string>();

export function bannerRequestDelay(placement: string): number {
  return Math.max(0, (nextRequests.get(placement) ?? 0) - Date.now());
}

// Preserve pacing when the native view is released on navigation/background.
// SDK refresh owns subsequent loads of a mounted banner.
export function recordBannerRequest(placement: string) {
  nextRequests.set(placement, Date.now() + BANNER_REQUEST_INTERVAL_MS);
  if (nextRequests.size > 100) nextRequests.delete(nextRequests.keys().next().value!);
}

export function recordBannerLoaded(placement: string) {
  recordBannerRequest(placement);
  unfilledPlacements.delete(placement);
}

// Like the web slot's unfilled state, a placement whose first load failed stays
// removed until it may request again.
export const isBannerUnfilled = (placement: string) => unfilledPlacements.has(placement) && bannerRequestDelay(placement) > 0;

export const getRecentBannerFailures = () => failures.map(failure => ({ ...failure }));

export function recordBannerFailure(placement: string, error: Error, initialLoad = false): string {
  recordBannerRequest(placement);
  if (initialLoad) unfilledPlacements.add(placement);
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
  const failure = { placement, code, at: new Date().toISOString() };
  failures.push(failure);
  if (failures.length > 50) failures.shift();
  // No user IDs, raw error payloads or ad response data in diagnostics.
  console.warn('[ads] banner load failed', failure);
  return code;
}
