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

export async function uploadAndInsertEditorImage(params: { editor: Editor; file: File; onSize?: (size: { width: number; height: number }) => void }): Promise<void> {
  const { editor } = params;
  validateImageFile(params.file);

  const compressed = await compressImageFile(params.file);
  const { file } = compressed;
  const { width, height } = compressed.width > 0 ? compressed : await getImageSize(file);
  if (width <= 0 || height <= 0) throw new Error("이미지 크기를 확인하지 못했습니다.");
  params.onSize?.({ width: Math.min(width, 760), height: Math.min(width, 760) * height / width });
  const { url } = await uploadImage(file);

  const initialWidth = width > 0 ? Math.min(width, 760) : 760;
  const insertPosition = editor.state.selection.to;

  editor
    .chain()
    .focus()
    .insertContentAt(insertPosition, {
      type: "imageResize",
      attrs: {
        src: url,
        width: initialWidth,
        height: Math.round(initialWidth * height / width),
        containerStyle: `width: ${initialWidth}px; height: auto; cursor: pointer; margin: 0.5rem 0;`,
        wrapperStyle: "display: flex; justify-content: flex-start; margin: 0;",
      },
    })
    .run();
}

const MAX_VIDEO_MB = 50;
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export const EDITOR_MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime";
export const MAX_EDITOR_VIDEOS = 3;

export function isEditorVideoFile(file: File) {
  return file.type.startsWith("video/");
}

function getVideoSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const done = (size: { width: number; height: number }) => {
      URL.revokeObjectURL(objectUrl);
      resolve(size);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => done({ width: 0, height: 0 });
    video.src = objectUrl;
  });
}

// 동영상은 서버 요청 본문 한도를 넘기 쉬워 서명 URL로 Storage에 바로 올린 뒤 서버가 파일을 검증한다.
// fetch는 업로드 진행률을 주지 않아 XHR로 올린다.
function putWithProgress(url: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(99, Math.floor((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("동영상 업로드에 실패했습니다.")));
    xhr.onerror = () => reject(new Error("동영상 업로드에 실패했습니다."));
    xhr.send(file);
  });
}

export async function uploadAndInsertEditorVideo(params: {
  editor: Editor;
  file: File;
  onSize?: (size: { width: number; height: number }) => void;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  const { editor, file } = params;
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) throw new Error("MP4, WEBM, MOV 동영상만 첨부할 수 있습니다.");
  if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) throw new Error(`동영상은 ${MAX_VIDEO_MB}MB 이하만 첨부할 수 있습니다.`);

  const { width, height } = await getVideoSize(file);
  const previewWidth = width > 0 ? Math.min(width, 760) : 760;
  params.onSize?.({ width: previewWidth, height: width > 0 && height > 0 ? previewWidth * height / width : previewWidth * 9 / 16 });
  const request = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/community/upload/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as { url?: string; path?: string; signedUrl?: string; error?: string } | null;
    if (!response.ok || !json?.url) throw new Error(json?.error ?? "동영상 업로드에 실패했습니다.");
    return json;
  };

  const signed = await request({ action: "sign", contentType: file.type, size: file.size, width, height });
  if (!signed.signedUrl || !signed.path) throw new Error("동영상 업로드에 실패했습니다.");
  params.onProgress?.(0);
  await putWithProgress(signed.signedUrl, file, params.onProgress);
  const { url } = await request({ action: "confirm", path: signed.path });

  editor
    .chain()
    .focus()
    .insertContentAt(editor.state.selection.to, { type: "video", attrs: { src: url } })
    .run();
}
