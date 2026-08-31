import { inspectCommunityImage } from "../community/upload-security.ts";

export const MINICON_UPLOAD_BUCKET = "minicons";
export const MINICON_MAX_BYTES = 2 * 1024 * 1024;
export const MINICON_SIZE = 200;
export const MINICON_MIN_PACK_ITEMS = 10;
export const MINICON_MAX_PACK_ITEMS = 50;

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/gif"]);

export function validateMiniconImage(bytes: Uint8Array, declaredType: string) {
  if (bytes.byteLength <= 0 || bytes.byteLength > MINICON_MAX_BYTES) {
    return { ok: false as const, error: "미니콘은 파일당 2MB 이하여야 합니다." };
  }

  const image = inspectCommunityImage(bytes);
  if (!image || !ALLOWED_TYPES.has(image.contentType)) {
    return { ok: false as const, error: "JPG, PNG, GIF 파일만 등록할 수 있습니다." };
  }
  if (declaredType && declaredType !== image.contentType) {
    return { ok: false as const, error: "파일 확장자와 실제 이미지 형식이 다릅니다." };
  }
  if (image.width !== MINICON_SIZE || image.height !== MINICON_SIZE) {
    return { ok: false as const, error: "미니콘 이미지는 정확히 200×200px이어야 합니다." };
  }

  return { ok: true as const, image };
}
