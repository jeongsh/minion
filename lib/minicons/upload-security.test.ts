import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { validateMiniconImage } from "./upload-security.ts";

test("200x200 PNG 미니콘을 허용한다", async () => {
  const bytes = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#03de8a" } }).png().toBuffer();
  const result = validateMiniconImage(bytes, "image/png");
  assert.equal(result.ok, true);
});

test("200x200이 아닌 이미지를 거절한다", async () => {
  const bytes = await sharp({ create: { width: 199, height: 200, channels: 4, background: "#03de8a" } }).png().toBuffer();
  const result = validateMiniconImage(bytes, "image/png");
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /200×200/);
});

test("WEBP 미니콘을 거절한다", async () => {
  const bytes = await sharp({ create: { width: 200, height: 200, channels: 4, background: "#03de8a" } }).webp().toBuffer();
  const result = validateMiniconImage(bytes, "image/webp");
  assert.equal(result.ok, false);
});
