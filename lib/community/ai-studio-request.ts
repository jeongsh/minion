import "server-only";

/** NextURL normalizes loopback IPs; the browser's Host retains its real origin. */
export function isStudioOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const requested = new URL(request.url);
    const host = request.headers.get("host");
    const expected = host ? new URL(`${requested.protocol}//${host}`) : requested;
    if (expected.username || expected.password || !["http:", "https:"].includes(expected.protocol)) return false;
    if (host && (expected.pathname !== "/" || expected.search || expected.hash)) return false;
    return new URL(origin).origin === origin && expected.origin === origin;
  } catch {
    return false;
  }
}

/** Bound streamed JSON before parsing; Content-Length is not trusted. */
export async function readStudioRequest(request: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new StudioRequestError("입력 내용을 보내 주세요.", 400);
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new StudioRequestError("입력 내용이 너무 큽니다. 참고 내용을 줄여 주세요.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StudioRequestError("입력 형식이 올바르지 않습니다.", 400);
  }
}

export class StudioRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StudioRequestError";
    this.status = status;
  }
}
