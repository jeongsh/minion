import type { CSSProperties } from "react";

export type ContentNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: ContentNode[];
};

export function contentDocument(content: string): ContentNode | null {
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === "object" && !Array.isArray(value)
      && (value as ContentNode).type === "doc" ? value as ContentNode : null;
  } catch {
    return null;
  }
}

/** Stored document attributes are untrusted, even when React escapes text. */
export function contentUrl(value: unknown, image = false): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const url = value.trim();
  if (image && /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(url)) return url;
  try {
    const parsed = new URL(url, "https://minion.fan");
    if (["https:", "http:", ...(!image ? ["mailto:", "tel:"] : [])].includes(parsed.protocol)) return url;
  } catch { /* Keep malformed URLs inert. */ }
  return undefined;
}

const dimension = /^-?\d+(?:\.\d+)?(?:px|em|rem|%|vw|vh)$|^auto$|^0$/i;
const imageLayoutEnums: Record<string, string[]> = {
  display: ["block", "inline-block", "inline", "flex", "none", "contents"],
  float: ["left", "right", "none"],
  "text-align": ["left", "center", "right", "justify"],
  cursor: ["pointer", "default", "auto", "move", "text", "nwse-resize", "nesw-resize", "ew-resize", "ns-resize"],
};

// Match the resize extension's persisted layout allowlist, without importing
// its ProseMirror runtime. Never accept arbitrary CSS from a stored document.
export function imageLayoutStyle(input: unknown): CSSProperties {
  const style: Record<string, string> = {};
  if (typeof input !== "string") return style;
  for (const declaration of input.split(";")) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration.slice(colon + 1).trim();
    const isSize = /^(?:(?:min-|max-)?(?:width|height)|(?:margin|padding)(?:-top|-right|-bottom|-left)?)$/.test(property);
    if (!(isSize && value.split(/\s+/).every((part) => dimension.test(part)))
      && !imageLayoutEnums[property]?.includes(value.toLowerCase())) continue;
    const key = property.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    if (!(key in style)) style[key] = value;
  }
  return style as CSSProperties;
}

export function contentColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return /^(?:#[a-f\d]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d.%\s,+/-]+\))$/i.test(value) ? value : undefined;
}

export function contentFontSize(value: unknown): string | undefined {
  return typeof value === "string" && /^(?:\d+(?:\.\d+)?(?:px|em|rem|pt|pc|in|cm|mm|q|ex|ch|cap|ic|lh|rlh|vw|vh|vi|vb|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|%)|0|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger|inherit|initial|unset|revert|revert-layer)$/i.test(value) ? value : undefined;
}

export function youtubeEmbedUrl(value: unknown, start: unknown): string | undefined {
  const safeUrl = contentUrl(value);
  if (!safeUrl) return undefined;
  try {
    const normalized = /^(?:(?:www|m|music)\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\//i.test(safeUrl)
      ? `https://${safeUrl}` : safeUrl.startsWith("//") ? `https:${safeUrl}` : safeUrl;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^(?:www|m|music)\./, "");
    if (!["youtube.com", "youtube-nocookie.com", "youtu.be"].includes(host)) return undefined;
    if (/^\/embed\/(?:[\w-]+)$/.test(url.pathname)) return url.href;
    // Preserve the editor's first v/list/shorts match, including a playlist
    // that precedes v in a watch URL, instead of silently changing its mode.
    const media = /(?:(v|list)=|shorts\/)([-\w]+)/.exec(normalized);
    const playlist = host !== "youtu.be" && media?.[1] === "list";
    const id = host === "youtu.be" ? url.pathname.slice(1) : media?.[2];
    if (!id || !/^[\w-]+$/.test(id)) return undefined;
    const embedded = new URL(playlist ? "https://www.youtube-nocookie.com/embed/videoseries" : `https://www.youtube.com/embed/${id}`);
    if (host === "youtu.be") {
      // The editor carries the short link's existing player query/hash through.
      embedded.search = url.search;
      embedded.hash = url.hash;
      return embedded.href;
    }
    if (playlist) embedded.searchParams.set("list", id);
    if (Number(start) > 0 && Number.isFinite(Number(start))) embedded.searchParams.set("start", String(Math.floor(Number(start))));
    embedded.searchParams.set("rel", "1");
    return embedded.href;
  } catch {
    return undefined;
  }
}
