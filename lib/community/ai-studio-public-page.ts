import "server-only";
import { extractStudioMedia } from "./ai-studio-media.ts";
import type { StudioSourceCollection } from "./ai-studio-collector.ts";
import { downloadStudioMedia } from "./ai-studio-media-storage.ts";

function plainText(html: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (raw, code: string) => {
      if (!code.startsWith("#")) return entities[code.toLowerCase()] ?? raw;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    }).replace(/\s+/g, " ").trim();
}

/** Site-specific markers prevent navigation, comments or a challenge page becoming the article. */
export function parseStudioPublicPage(html: string, url: string): StudioSourceCollection | null {
  const id = /^https:\/\/www\.fmkorea\.com\/(\d{1,20})$/.exec(url)?.[1];
  if (html.length > 1_000_000) return null;
  if (!id) {
    const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1];
    const title = /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i.exec(html)?.[1] ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
    if (!article || !title || /just a moment|access denied|captcha/i.test(plainText(title))) return null;
    const body = plainText(article);
    const media = extractStudioMedia(article, url);
    if (!body && !media.length) return null;
    return { collectedAt: new Date().toISOString(), sourceUrl: url, collectionMethod: "public_page", warnings: ["공개 기사 본문을 읽었습니다. 영상은 별도 분석 또는 직접 확인이 필요합니다.", ...(body.length > 1400 ? ["긴 본문은 앞부분 1,400자까지만 가져왔습니다."] : [])], sources: [{ media, id: url, url, title: plainText(title).slice(0, 200), excerpt: body.slice(0, 1400), comments: [], publishedAt: null, kind: "web_reference", collectionMethod: "public_page" }] };
  }
  const start = html.indexOf(`<!--BeforeDocument(${id},`);
  const end = html.indexOf(`<!--AfterDocument(${id},`, start);
  if (start < 0 || end <= start) return null;
  const titleHtml = /<meta\s+property="og:title"\s+content="([^"]*)"[^>]*>/i.exec(html)?.[1];
  if (!titleHtml) return null;
  const title = plainText(titleHtml).slice(0, 200);
  const article = html.slice(start, end);
  const body = plainText(article);
  if (!title || (!body && !/<(?:img|video|iframe)\b/i.test(article))) return null;
  const rawDate = /class="date m_no"[^>]*>(\d{4}\.\d{2}\.\d{2})/.exec(html)?.[1]?.replaceAll(".", "-");
  const publishedAt = rawDate && Number.isFinite(Date.parse(rawDate)) && new Date(rawDate).toISOString().slice(0, 10) === rawDate ? rawDate : null;
  const warnings = ["공개 페이지의 제목과 본문 텍스트를 읽었습니다. 작성자의 주장이며 별도 사실 확인이 필요합니다."];
  if (!body.replace(/https?:\/\/\S+/g, "").trim() || /<(?:img|video|iframe)\b/i.test(article)) warnings.push("영상·이미지·외부 링크의 내용은 분석하지 않았습니다. 필요한 장면이나 발언은 참고 내용에 추가해 주세요.");
  if (body.length > 1_400) warnings.push("긴 본문은 앞부분 1,400자까지만 가져왔습니다.");
  if (!publishedAt) warnings.push("게시 날짜를 확인하지 못했습니다.");
  else if (Date.now() - Date.parse(publishedAt) > 7 * 86_400_000) warnings.push("7일보다 오래된 소재입니다. 게시 날짜를 확인해 주세요.");
  return { collectedAt: new Date().toISOString(), sourceUrl: url, collectionMethod: "public_page", warnings,
    sources: [{ media: extractStudioMedia(article, url), id: url, url, title, excerpt: body ? `본문 발췌: ${body.slice(0, 1_400)}` : "텍스트 본문 없이 미디어가 첨부된 게시글입니다.", comments: [], publishedAt, kind: "web_reference", collectionMethod: "public_page" }] };
}

/** Only canonical, fixed-host article URLs; no redirects, cookies, scripts or embedded requests. */
export async function readStudioPublicPage(url: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<StudioSourceCollection | null> {
  if (!/^https:\/\/www\.fmkorea\.com\/\d{1,20}$/.test(url)) {
    // General article pages use DNS-pinned HTTPS; platform embeds remain source URLs.
    if (fetcher !== fetch || /(?:youtube\.com|instagram\.com|x\.com|twitter\.com)\//.test(url)) return null;
    try { return parseStudioPublicPage((await downloadStudioMedia(url, 1_000_000, 0, true)).bytes.toString("utf8"), url); } catch { return null; }
  }
  const timeout = AbortSignal.timeout(8_000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetcher(url, { redirect: "error", cache: "no-store", signal: requestSignal, headers: { accept: "text/html" } });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html") || !response.body || Number(response.headers.get("content-length")) > 1_000_000) { await response.body?.cancel(); return null; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 1_000_000) { await reader.cancel(); return null; }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    return parseStudioPublicPage(Buffer.concat(chunks).toString("utf8"), url);
  } catch { return null; }
}
