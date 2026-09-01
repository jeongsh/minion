import sharp from "sharp";

export type ResizedImage = {
  bytes: Buffer;
  contentType: string;
  extension: string;
  transformed: boolean;
};

/**
 * 업로드/수집한 이미지를 지정한 최대 변 길이로 리사이즈하고 webp로 변환한다.
 * 원본을 그대로 저장/서빙하면 화면에 표시되는 크기(수십~수백px)에 비해
 * 훨씬 큰 파일이 그대로 나가 페이지가 느려지므로, 저장 전에 한 번 줄인다.
 * GIF는 애니메이션이 깨지므로, sharp가 다루지 못하는 포맷이면 원본을 그대로 통과시킨다.
 */
export async function resizeImageForWeb(
  bytes: Buffer,
  contentType: string,
  {
    maxEdge,
    quality = 84,
    preserveGif = true,
  }: { maxEdge: number; quality?: number; preserveGif?: boolean },
): Promise<ResizedImage> {
  if (contentType === "image/gif" && preserveGif) {
    return { bytes, contentType, extension: "gif", transformed: false };
  }

  try {
    const output = await sharp(bytes)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    return { bytes: output, contentType: "image/webp", extension: "webp", transformed: true };
  } catch {
    return { bytes, contentType, extension: "jpg", transformed: false };
  }
}
