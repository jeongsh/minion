/** Bounded transient retries. Never log URLs containing API credentials. */
export async function retryFetch(
  input: string | URL,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number; baseDelayMs?: number; maxDelayMs?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const retries = options.retries ?? 1;
  const maxDelayMs = options.maxDelayMs ?? 5_000;
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(input, { ...init, signal: AbortSignal.timeout(options.timeoutMs ?? 10_000) });
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(Math.min(maxDelayMs, (options.baseDelayMs ?? 1_000) * 2 ** attempt));
      continue;
    }
    if (attempt >= retries || !(response.status === 408 || response.status === 429 || response.status >= 500)) return response;
    const retryAfter = response.headers.get("retry-after");
    const backoff = Math.min(maxDelayMs, (options.baseDelayMs ?? 1_000) * 2 ** attempt);
    const retryMs = retryAfter === null ? 0 : /^\d+$/.test(retryAfter.trim())
      ? Number(retryAfter) * 1_000 : Math.max(0, Date.parse(retryAfter) - Date.now());
    // Let the next scheduled run retry long cooldowns instead of violating Retry-After.
    if (!Number.isFinite(retryMs) || retryMs > maxDelayMs) return response;
    await response.body?.cancel();
    await sleep(Math.max(backoff, retryMs));
  }
}
