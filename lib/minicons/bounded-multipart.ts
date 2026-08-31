import { MINICON_MAX_BYTES } from "./upload-security.ts";

export const MINICON_MAX_MULTIPART_BODY_BYTES = MINICON_MAX_BYTES + 64 * 1024;

export type BoundedMiniconFormDataResult =
  | { ok: true; formData: FormData }
  | { ok: false; error: string; status: number };

/** 브라우저 Content-Length를 신뢰하지 않고 스트림을 제한 크기까지만 읽는다. */
export async function readBoundedMiniconFormData(
  request: Request,
): Promise<BoundedMiniconFormDataResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return { ok: false, error: "업로드 요청 형식이 올바르지 않습니다.", status: 400 };
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0) {
      return { ok: false, error: "업로드 요청 크기가 올바르지 않습니다.", status: 400 };
    }
    if (contentLength > MINICON_MAX_MULTIPART_BODY_BYTES) {
      return { ok: false, error: "미니콘은 파일당 2MB 이하여야 합니다.", status: 413 };
    }
  }

  if (!request.body) {
    return { ok: false, error: "업로드할 파일이 없습니다.", status: 400 };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MINICON_MAX_MULTIPART_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, error: "미니콘은 파일당 2MB 이하여야 합니다.", status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: "업로드 요청을 읽지 못했습니다.", status: 400 };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const replay = new Request("http://minion.local/api/minicons/upload", {
      method: "POST",
      headers: { "content-type": contentType },
      body: bytes.buffer as ArrayBuffer,
    });
    return { ok: true, formData: await replay.formData() };
  } catch {
    return { ok: false, error: "업로드 요청 형식이 올바르지 않습니다.", status: 400 };
  }
}
