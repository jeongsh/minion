import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { prepareProfileImage } from "./prepare-profile-image.ts";

for (const format of ["png", "jpeg", "webp", "gif", "avif", "tiff"] as const) {
  test(`profile ${format}: decode actual bytes and produce a bounded WebP`, async () => {
    const source = await sharp({ create: { width: 1200, height: 600, channels: 4, background: "red" } }).toFormat(format).toBuffer();
    const result = await prepareProfileImage(source);
    const metadata = await sharp(result.bytes).metadata();
    assert.equal(result.contentType, "image/webp");
    assert.equal(result.extension, "webp");
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 512);
    assert.equal(metadata.height, 256);
    assert.equal(metadata.exif, undefined);
  });
}

test("profile rejects corrupt bytes and SVG instead of publishing the original", async () => {
  for (const source of [Buffer.from("broken image"), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')]) {
    await assert.rejects(prepareProfileImage(source));
  }
});

test("profile preserves dimensions of small images and applies EXIF rotation", async () => {
  const source = await sharp({ create: { width: 80, height: 40, channels: 3, background: "blue" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await prepareProfileImage(source);
  const metadata = await sharp(result.bytes).metadata();
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 80);
  assert.equal(metadata.orientation, undefined);
});
