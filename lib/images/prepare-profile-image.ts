import sharp from "sharp";

// Decode and re-encode rather than trusting optional picker MIME metadata or
// passing undecodable originals through to the public avatar bucket.
export async function prepareProfileImage(bytes: Buffer) {
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const metadata = await image.metadata();
  if (!metadata.format || !["png", "jpeg", "webp", "gif", "heif", "tiff"].includes(metadata.format)) {
    throw new Error("지원하지 않는 이미지 형식입니다.");
  }
  const result = await image.rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 }).toBuffer();
  return { bytes: result, contentType: "image/webp", extension: "webp" };
}
