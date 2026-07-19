import assert from "node:assert/strict";
import test from "node:test";

import {
  checkUploadRateLimit,
  COMMUNITY_UPLOAD_RATE_LIMIT_MAX,
  communityUploadPrefix,
  inspectCommunityImage,
  validateCommunityImage,
} from "./upload-security.ts";

const PNG_1X1 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
  0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);

const GIF_2X3 = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x02, 0x00, 0x03, 0x00,
]);

function png(width: number, height: number) {
  const bytes = Buffer.from(PNG_1X1);
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

test("inspects image type and dimensions from file signatures", () => {
  assert.deepEqual(inspectCommunityImage(PNG_1X1), {
    contentType: "image/png",
    extension: "png",
    width: 1,
    height: 1,
  });

  assert.deepEqual(inspectCommunityImage(GIF_2X3), {
    contentType: "image/gif",
    extension: "gif",
    width: 2,
    height: 3,
  });
});

test("rejects mismatched declared content type", () => {
  const result = validateCommunityImage(PNG_1X1, "image/jpeg");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.match(result.error, /MIME type/);
  }
});

test("rejects oversized dimensions", () => {
  const result = validateCommunityImage(png(4097, 1), "image/png");
  assert.equal(result.ok, false);
});

test("limits burst uploads per user", () => {
  const store = new Map<string, { count: number; resetAt: number }>();
  const now = Date.parse("2026-07-19T00:00:00.000Z");

  for (let index = 0; index < COMMUNITY_UPLOAD_RATE_LIMIT_MAX; index += 1) {
    assert.deepEqual(checkUploadRateLimit("user-1", store, now), { ok: true });
  }

  assert.deepEqual(checkUploadRateLimit("user-1", store, now), {
    ok: false,
    retryAfterSeconds: 60,
  });

  assert.deepEqual(checkUploadRateLimit("user-1", store, now + 60_000), { ok: true });
});

test("builds daily upload prefixes from UTC dates", () => {
  assert.equal(
    communityUploadPrefix("user-1", new Date("2026-07-19T23:59:59.000Z")),
    "user-1/2026-07-19",
  );
});
