// 글 본문(에디터 JSON)에서 갤러리 썸네일을 추출한다.
// 첫 이미지(image/imageResize) src 를 우선 사용하고, 없으면 유튜브 썸네일로 대체.
// 본문은 CommunityEditor 가 저장한 ProseMirror JSON 문자열.

function youtubeThumbnail(src: string): string | null {
  // https://www.youtube.com/watch?v=ID, youtu.be/ID, /embed/ID 등에서 ID 추출.
  const match = src.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export function extractThumbnail(content: string): string | null {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return null;
  }

  let imageSrc: string | null = null;
  let youtubeSrc: string | null = null;

  const walk = (node: unknown) => {
    if (imageSrc || !node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const attrs = (record.attrs ?? {}) as Record<string, unknown>;

    if ((record.type === "image" || record.type === "imageResize") && typeof attrs.src === "string") {
      imageSrc = attrs.src;
      return;
    }
    if (record.type === "youtube" && typeof attrs.src === "string" && !youtubeSrc) {
      youtubeSrc = youtubeThumbnail(attrs.src);
    }
    if (Array.isArray(record.content)) record.content.forEach(walk);
  };

  walk(doc);
  return imageSrc ?? youtubeSrc;
}

// 본문에서 미리보기용 평문 일부를 추출(갤러리 카드 보조 텍스트).
export function extractPlainText(content: string, limit = 80): string {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return "";
  }

  const parts: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") {
      parts.push(record.text);
    }
    if (Array.isArray(record.content)) record.content.forEach(walk);
  };
  walk(doc);

  return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, limit);
}
