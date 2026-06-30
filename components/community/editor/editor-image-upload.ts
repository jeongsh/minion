import type { Editor } from "@tiptap/react";

const MAX_IMAGE_MB = 20;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const COMPRESS_MAX_DIMENSION = 1920;
const COMPRESS_QUALITY = 0.85;

export function getImageUploadErrorMessage(error: unknown, fallback = "이미지 처리에 실패했습니다."): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("PNG, JPG, WEBP, GIF 이미지만 업로드할 수 있습니다.");
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error(`이미지는 ${MAX_IMAGE_MB}MB 이하만 업로드할 수 있습니다.`);
  }
}

// 업로드 전 브라우저에서 리사이즈/압축. GIF은 애니메이션 보존을 위해 원본 유지.
async function compressImageFile(file: File): Promise<{ file: File; width: number; height: number }> {
  if (file.type === "image/gif") {
    return { file, width: 0, height: 0 };
  }

  const bitmap = await createImageBitmap(file);
  const origW = bitmap.width;
  const origH = bitmap.height;

  const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(origW, origH));
  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, COMPRESS_QUALITY));

  let blob = await toBlob("image/webp");
  let outType = "image/webp";
  let ext = "webp";

  if (!blob || blob.size === 0) {
    blob = await toBlob("image/jpeg");
    outType = "image/jpeg";
    ext = "jpg";
  }

  if (!blob) throw new Error("이미지 압축에 실패했습니다.");

  // 리사이즈 없이 압축 결과가 더 크면 원본 사용.
  const useCompressed = scale < 1 || blob.size < file.size;
  if (!useCompressed) {
    return { file, width: origW, height: origH };
  }

  const baseName = file.name.replace(/\.[^.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.${ext}`, { type: outType });
  return { file: compressedFile, width: targetW, height: targetH };
}

export function getImageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(objectUrl);
    };
    image.src = objectUrl;
  });
}

// 공개 버킷에 업로드하고 공개 URL을 받는다(서버 라우트가 service-role 로 업로드).
async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/community/upload", {
    method: "POST",
    body: formData,
  });

  const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !body?.url) {
    throw new Error(body?.error ?? "이미지 업로드에 실패했습니다.");
  }
  return { url: body.url };
}

export async function uploadAndInsertEditorImage(params: { editor: Editor; file: File }): Promise<void> {
  const { editor } = params;
  validateImageFile(params.file);

  const { file, width } = await compressImageFile(params.file);
  const { url } = await uploadImage(file);

  const initialWidth = width > 0 ? Math.min(width, 760) : 760;

  editor
    .chain()
    .focus()
    .setImage({
      src: url,
      width: initialWidth,
      containerStyle: `width: ${initialWidth}px; height: auto; cursor: pointer; margin: 0.5rem auto;`,
      wrapperStyle: "display: flex; margin: 0;",
    } as never)
    .run();
}
