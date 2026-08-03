import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

function signingKey() {
  return process.env.NEWS_THUMBNAIL_SIGNING_SECRET?.trim()
    || process.env.NAVER_API_HUB_CLIENT_SECRET?.trim()
    || "";
}

export function isSafePublicNewsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      hostname === "localhost"
      || hostname.endsWith(".localhost")
      || hostname.endsWith(".local")
      || hostname.endsWith(".internal")
      || hostname === "::1"
      || hostname.includes(":")
    ) return false;

    const ipv4 = hostname.split(".").map(Number);
    if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
      const [a, b] = ipv4;
      if (
        a === 0
        || a === 10
        || a === 127
        || a >= 224
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 168)
      ) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function signNewsThumbnailUrl(value: string) {
  const key = signingKey();
  if (!key) return "";
  return createHmac("sha256", key).update(value).digest("base64url").slice(0, 32);
}

export function verifyNewsThumbnailSignature(value: string, signature: string) {
  const expected = signNewsThumbnailUrl(value);
  if (!expected || !signature || expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function newsThumbnailProxyUrl(value: string) {
  if (!isSafePublicNewsUrl(value)) return undefined;
  const signature = signNewsThumbnailUrl(value);
  if (!signature) return undefined;
  return `/api/news/thumbnail?url=${encodeURIComponent(value)}&sig=${signature}`;
}
