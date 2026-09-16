import { normalizeStudioSourceUrl } from "./ai-studio-source-url.ts";

export type StudioMedia = { kind: "youtube" | "twitter" | "instagram" | "image" | "video"; url: string };
export type StudioSourceContext = { media?: StudioMedia[]; mediaContext?: string; mediaReviewed?: boolean };

export function parseStudioMedia(value: unknown): StudioMedia[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) throw new Error("첨부 미디어는 최대 8개입니다.");
  return value.map(item => {
    if (!item || typeof item !== "object" || !["youtube", "twitter", "instagram", "image", "video"].includes(item.kind)) throw new Error("첨부 미디어 형식이 올바르지 않습니다.");
    const url = normalizeStudioSourceUrl(item.url);
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (item.kind === "youtube" && !/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(url)) throw new Error("유튜브 영상 주소를 확인해 주세요.");
    if (item.kind === "twitter" && !["x.com", "twitter.com"].includes(host)) throw new Error("X 게시물 주소를 확인해 주세요.");
    if (item.kind === "instagram" && host !== "instagram.com") throw new Error("인스타그램 주소를 확인해 주세요.");
    return { kind: item.kind, url };
  });
}

export function extractStudioMedia(html: string, sourceUrl: string): StudioMedia[] {
  const found: StudioMedia[] = [];
  const add = (raw: string, kind?: StudioMedia["kind"]) => {
    try {
      const url = normalizeStudioSourceUrl(new URL(raw.replaceAll("&amp;", "&"), sourceUrl).href);
      const host = new URL(url).hostname.replace(/^www\./, "");
      const inferred = kind ?? (/youtube\.com\/watch\?v=/.test(url) ? "youtube" : ["x.com", "twitter.com"].includes(host) ? "twitter" : host === "instagram.com" ? "instagram" : null);
      if (inferred && !found.some(item => item.url === url)) found.push(...parseStudioMedia([{ kind: inferred, url }]));
    } catch { /* Non-public or unsupported embeds are not imported. */ }
  };
  add(sourceUrl);
  for (const tag of html.matchAll(/<(img|video|source)\b[^>]*>/gi)) {
    const src = /(?:src|data-original)=["']([^"']+)["']/i.exec(tag[0])?.[1];
    if (src) add(src, tag[1].toLowerCase() === "img" ? "image" : "video");
  }
  for (const match of html.matchAll(/https?:\/\/[^\s<>"']+/g)) add(match[0]);
  return found.slice(0, 8);
}

export function studioMediaNodes(media: StudioMedia[] = []) {
  return parseStudioMedia(media).map(item => item.kind === "youtube" ? { type: "youtube", attrs: { src: item.url, width: 640, height: 360 } }
    : item.kind === "image" ? { type: "image", attrs: { src: item.url, alt: "원문 첨부 이미지" } }
    : item.kind === "video" ? { type: "video", attrs: { src: item.url } }
    : { type: "embed", attrs: { url: item.url, type: item.kind } });
}

export function studioContextFields(value: Record<string, unknown>): Required<StudioSourceContext> {
  const mediaContext = value.mediaContext ?? "";
  if (typeof mediaContext !== "string" || mediaContext.length > 6_000) throw new Error("원문 맥락 설명은 6,000자 이하여야 합니다.");
  if (value.mediaReviewed !== undefined && typeof value.mediaReviewed !== "boolean") throw new Error("미디어 확인 상태가 올바르지 않습니다.");
  const media = value.media === undefined ? extractStudioMedia(typeof value.facts === "string" ? value.facts : "", typeof value.sourceUrl === "string" && value.sourceUrl ? value.sourceUrl : "https://minion.fan") : parseStudioMedia(value.media);
  return { media, mediaContext, mediaReviewed: value.mediaReviewed === true };
}
