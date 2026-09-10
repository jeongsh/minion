/** Retry transient upstream failures once. Never log URLs containing API credentials. */
export async function retryFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
    } catch (error) {
      if (attempt > 0) throw error;
      await sleep(1_000);
      continue;
    }
    if (attempt > 0 || !(response.status === 408 || response.status === 429 || response.status >= 500)) return response;
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter ? Number(retryAfter) : 1;
    // Let the next scheduled run retry long cooldowns instead of violating Retry-After.
    if (!Number.isFinite(seconds) || seconds > 5) return response;
    await response.body?.cancel();
    await sleep(Math.max(1, seconds) * 1_000);
  }
}
