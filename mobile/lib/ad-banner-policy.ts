export function bannerRetryDelay(code: string, retries: number): number | null {
  if (retries >= 2) return null;
  const kind = code.split('/').at(-1)?.replace(/^error-code-/, '');
  if (kind === 'network-error' || kind === 'internal-error') return 30_000 * 2 ** retries;
  if (kind === 'no-fill' || kind === 'mediation-no-fill') return 60_000 * 2 ** retries;
  return null;
}

type BannerFailure = { placement: string; code: string; retries: number; at: string };
const failures: BannerFailure[] = [];
export const getRecentBannerFailures = () => failures.map(failure => ({ ...failure }));

export function recordBannerFailure(placement: string, error: Error, retries: number): string {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : 'unknown';
  const failure = { placement, code, retries, at: new Date().toISOString() };
  failures.push(failure);
  if (failures.length > 50) failures.shift();
  // No user IDs, raw error payloads or ad response data in diagnostics.
  console.warn('[ads] banner load failed', failure);
  return code;
}
