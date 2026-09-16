import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { StudioMedia } from "./ai-studio-media.ts";
import { normalizeStudioSourceUrl } from "./ai-studio-source-url.ts";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const str = (value: unknown) => typeof value === "string" ? value : "";
export type StudioSocialSource = { text: string; attachments: StudioMedia[]; warnings: string[] };

export function studioSocialUrl(item: StudioMedia) {
  const url = new URL(normalizeStudioSourceUrl(item.url));
  const host = url.hostname.replace(/^www\./, "");
  if (item.kind === "twitter" && ["x.com", "twitter.com"].includes(host)) {
    const id = /^\/(?:[\w]+\/status|i\/web\/status)\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/.exec(url.pathname)?.[1];
    if (id) return { id, url: `https://x.com/i/web/status/${id}` };
  }
  if (item.kind === "instagram" && host === "instagram.com") {
    const id = /^\/(?:p|reel|reels|tv)\/([\w-]{1,40})\/?$/.exec(url.pathname)?.[1];
    if (id) return { id, url: `https://www.instagram.com/p/${id}/` };
  }
  throw new Error("SNS 프로필이 아닌 공개 게시물 주소를 입력해 주세요.");
}

function addAsset(output: StudioMedia[], raw: unknown, kind: "image" | "video") {
  try {
    const url = normalizeStudioSourceUrl(raw);
    if (!output.some(item => item.url === url)) output.push({ kind, url });
  } catch { /* Unusable attachments are reported by the analysis coverage. */ }
}

export function parseStudioTweet(value: unknown, id: string): StudioSocialSource {
  const data = object(value);
  if (str(data.id_str) !== id) throw new Error("요청한 X 게시물의 내용을 확인하지 못했습니다.");
  const attachments: StudioMedia[] = [];
  const warnings = ["공개 임베드에서 확인한 게시물만 분석합니다. 댓글·인용 게시물 전체는 수집하지 않습니다."];
  for (const raw of array(data.mediaDetails)) {
    const media = object(raw);
    if (media.type === "photo") addAsset(attachments, media.media_url_https, "image");
    else if (["video", "animated_gif"].includes(str(media.type))) {
      const variants = array(object(media.video_info).variants).map(object)
        .filter(v => v.content_type === "video/mp4")
        .sort((a, b) => Number(b.bitrate ?? 0) - Number(a.bitrate ?? 0));
      if (variants.length) addAsset(attachments, variants[0].url, "video");
      else warnings.push("영상 파일 주소를 확인하지 못했습니다. 영상 내용은 미확인입니다.");
    }
  }
  if (!array(data.mediaDetails).length) for (const photo of array(data.photos)) addAsset(attachments, object(photo).url, "image");
  return { text: str(data.text).slice(0, 12000), attachments, warnings };
}

/** yt-dlp metadata is scoped to one canonical post; thumbnails are not video evidence. */
export function parseStudioInstagramMetadata(value: unknown): StudioSocialSource {
  const data = object(value);
  const attachments: StudioMedia[] = [];
  const warnings: string[] = ["게시물 본문과 접근 가능한 첨부만 분석합니다. 댓글은 수집하지 않습니다."];
  const entries = Array.isArray(data.entries) ? data.entries : [data];
  const captions = new Set<string>([str(data.description)]);
  for (const raw of entries.slice(0, 20)) {
    const entry = object(raw);
    captions.add(str(entry.description));
    const formats = array(entry.formats).map(object).filter(f => f.ext === "mp4" && f.vcodec !== "none" && f.acodec !== "none");
    formats.sort((a, b) => Number(b.height ?? 0) - Number(a.height ?? 0));
    const direct = entry.ext === "mp4" ? entry.url : formats[0]?.url;
    if (direct) addAsset(attachments, direct, "video");
    else if (!array(entry.formats).length && !Number(entry.duration)) {
      const thumbnails = array(entry.thumbnails).map(object);
      addAsset(attachments, entry.thumbnail ?? thumbnails.at(-1)?.url, "image");
    } else warnings.push("첨부 영상의 직접 파일 주소를 확인하지 못했습니다.");
  }
  if (entries.length > 20) warnings.push("첨부가 많아 앞부분만 수집했습니다.");
  return { text: [...captions].filter(Boolean).join("\n").slice(0, 12000), attachments, warnings };
}

function decode(text: string) {
  return text.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function parseStudioInstagramEmbed(html: string): StudioSocialSource {
  const attachments: StudioMedia[] = [];
  const caption = /<div\b[^>]*class=["'][^"']*\bCaption\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? "";
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/class=["'][^"']*\bEmbeddedMediaImage\b/.test(match[0])) continue;
    const src = /\bsrc=["']([^"']+)["']/i.exec(match[0])?.[1];
    if (src) addAsset(attachments, decode(src), "image");
  }
  const text = decode(caption.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, " ")).trim().slice(0, 12000);
  return { text, attachments, warnings: ["공개 임베드의 본문과 대표 이미지만 확인했습니다. 영상 재생 내용·다른 슬라이드·댓글은 미확인입니다."] };
}

async function publicResponse(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, { redirect: "error", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Googlebot", accept: "application/json,text/html" } });
  if (!response.ok || !response.body) throw new Error("SNS 공개 게시물에 접근하지 못했습니다.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); throw new Error("SNS 응답이 너무 큽니다."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readStudioSocialSource(item: StudioMedia, options: { fetcher?: typeof fetch; metadata?: (url: string) => Promise<unknown> } = {}): Promise<StudioSocialSource> {
  const target = studioSocialUrl(item);
  const fetcher = options.fetcher ?? fetch;
  if (item.kind === "twitter") {
    const token = ((Number(target.id) / 1e15) * Math.PI).toString(36).replace(/0|\./g, "");
    const raw = await publicResponse(`https://cdn.syndication.twimg.com/tweet-result?id=${target.id}&token=${token}`, fetcher);
    const result = parseStudioTweet(JSON.parse(raw), target.id);
    if (!result.text && !result.attachments.length) throw new Error("X 게시물 본문과 첨부를 확인하지 못했습니다.");
    return result;
  }
  try {
    const metadata = options.metadata ?? (async (url: string) => {
      const result = await promisify(execFile)(process.env.STUDIO_YTDLP_PATH || "yt-dlp", ["--ignore-config", "--skip-download", "--dump-single-json", "--ignore-no-formats-error", "--socket-timeout", "10", "--retries", "0", "--playlist-end", "20", "--", url], { timeout: 45000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      return JSON.parse(result.stdout);
    });
    const result = parseStudioInstagramMetadata(await metadata(target.url));
    if (result.text || result.attachments.length) return result;
  } catch { /* Public embed fallback uses no account cookies or login bypass. */ }
  const result = parseStudioInstagramEmbed(await publicResponse(`${target.url}embed/captioned/`, fetcher));
  if (!result.text && !result.attachments.length) throw new Error("인스타그램 게시물이 비공개이거나 접근이 제한되어 본문·첨부를 읽지 못했습니다.");
  return result;
}
