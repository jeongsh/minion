export const COMMUNITY_UPLOAD_BUCKET = "community-media";
export const COMMUNITY_UPLOAD_MAX_BYTES = 6 * 1024 * 1024;
export const COMMUNITY_UPLOAD_MAX_WIDTH = 4096;
export const COMMUNITY_UPLOAD_MAX_HEIGHT = 4096;
export const COMMUNITY_UPLOAD_DAILY_LIMIT = 30;
export const COMMUNITY_UPLOAD_RATE_LIMIT_WINDOW_MS = 60_000;
export const COMMUNITY_UPLOAD_RATE_LIMIT_MAX = 6;

export type CommunityImageType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

export type ImageInspection = {
  contentType: CommunityImageType;
  extension: "png" | "jpg" | "webp" | "gif";
  width: number;
  height: number;
};

export type UploadRateLimitState = {
  count: number;
  resetAt: number;
};

export type UploadRateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOI = [0xff, 0xd8];

function ascii(bytes: Uint8Array, start: number, length: number) {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readUint16Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint16Be(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24Le(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function matches(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function inspectPng(bytes: Uint8Array): ImageInspection | null {
  if (bytes.length < 24 || !matches(bytes, PNG_SIGNATURE)) return null;

  return {
    contentType: "image/png",
    extension: "png",
    width: bytes[16] * 256 ** 3 + bytes[17] * 256 ** 2 + bytes[18] * 256 + bytes[19],
    height: bytes[20] * 256 ** 3 + bytes[21] * 256 ** 2 + bytes[22] * 256 + bytes[23],
  };
}

function inspectGif(bytes: Uint8Array): ImageInspection | null {
  if (bytes.length < 10) return null;

  const header = ascii(bytes, 0, 6);
  if (header !== "GIF87a" && header !== "GIF89a") return null;

  return {
    contentType: "image/gif",
    extension: "gif",
    width: readUint16Le(bytes, 6),
    height: readUint16Le(bytes, 8),
  };
}

function inspectJpeg(bytes: Uint8Array): ImageInspection | null {
  if (bytes.length < 4 || !matches(bytes, JPEG_SOI)) return null;

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;

    const segmentLength = readUint16Be(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && segmentLength >= 7) {
      return {
        contentType: "image/jpeg",
        extension: "jpg",
        width: readUint16Be(bytes, offset + 5),
        height: readUint16Be(bytes, offset + 3),
      };
    }

    offset += segmentLength;
  }

  return null;
}

function inspectWebp(bytes: Uint8Array): ImageInspection | null {
  if (bytes.length < 25 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      contentType: "image/webp",
      extension: "webp",
      width: readUint24Le(bytes, 24) + 1,
      height: readUint24Le(bytes, 27) + 1,
    };
  }

  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      contentType: "image/webp",
      extension: "webp",
      width: readUint16Le(bytes, 26) & 0x3fff,
      height: readUint16Le(bytes, 28) & 0x3fff,
    };
  }

  if (chunk === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];

    return {
      contentType: "image/webp",
      extension: "webp",
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + ((b3 << 6) | (b2 >> 2) | ((b1 & 0xc0) << 6)),
    };
  }

  return null;
}

export function inspectCommunityImage(bytes: Uint8Array): ImageInspection | null {
  return inspectPng(bytes) ?? inspectJpeg(bytes) ?? inspectWebp(bytes) ?? inspectGif(bytes);
}

export function validateCommunityImage(bytes: Uint8Array, declaredType: string) {
  if (bytes.byteLength <= 0 || bytes.byteLength > COMMUNITY_UPLOAD_MAX_BYTES) {
    return {
      ok: false as const,
      status: 400,
      error: `Images must be ${Math.floor(COMMUNITY_UPLOAD_MAX_BYTES / 1024 / 1024)}MB or smaller.`,
    };
  }

  const image = inspectCommunityImage(bytes);
  if (!image) {
    return {
      ok: false as const,
      status: 400,
      error: "Only valid PNG, JPG, WEBP, or GIF images can be uploaded.",
    };
  }

  if (declaredType && declaredType !== image.contentType) {
    return {
      ok: false as const,
      status: 400,
      error: "The declared MIME type does not match the image content.",
    };
  }

  if (
    image.width <= 0 ||
    image.height <= 0 ||
    image.width > COMMUNITY_UPLOAD_MAX_WIDTH ||
    image.height > COMMUNITY_UPLOAD_MAX_HEIGHT
  ) {
    return {
      ok: false as const,
      status: 400,
      error: `Image dimensions must be ${COMMUNITY_UPLOAD_MAX_WIDTH}x${COMMUNITY_UPLOAD_MAX_HEIGHT} or smaller.`,
    };
  }

  return { ok: true as const, image };
}

export function checkUploadRateLimit(
  key: string,
  store: Map<string, UploadRateLimitState>,
  now = Date.now(),
): UploadRateLimitResult {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + COMMUNITY_UPLOAD_RATE_LIMIT_WINDOW_MS });
    return { ok: true };
  }

  if (current.count >= COMMUNITY_UPLOAD_RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { ok: true };
}

export function communityUploadPrefix(userId: string, now = new Date()) {
  return `${userId}/${now.toISOString().slice(0, 10)}`;
}
