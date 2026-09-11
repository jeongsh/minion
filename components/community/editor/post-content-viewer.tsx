import { createElement, Fragment, type ReactNode } from "react";

import { PollVoter, type PollOption } from "@/components/community/poll-voter";
import { ReadOnlyEmbed } from "./read-only-embed";
import { contentColor, contentDocument, contentFontSize, contentUrl, imageLayoutStyle, youtubeEmbedUrl, type ContentNode } from "@/lib/community/read-only-content";

function textAttribute(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function markedText(node: ContentNode): ReactNode {
  let text: ReactNode = typeof node.text === "string" ? node.text : "";
  for (const mark of [...(Array.isArray(node.marks) ? node.marks : [])].reverse()) {
    if (!mark || typeof mark !== "object") continue;
    const attrs = mark.attrs ?? {};
    if (mark.type === "bold") text = <strong>{text}</strong>;
    else if (mark.type === "italic") text = <em>{text}</em>;
    else if (mark.type === "strike") text = <s>{text}</s>;
    else if (mark.type === "underline") text = <u>{text}</u>;
    else if (mark.type === "code") text = <code>{text}</code>;
    else if (mark.type === "link") {
      const href = contentUrl(attrs.href);
      if (href) text = <a href={href} target={attrs.target === undefined ? "_blank" : textAttribute(attrs.target)} rel="noopener noreferrer nofollow" title={textAttribute(attrs.title)}>{text}</a>;
    } else if (mark.type === "textStyle") {
      text = <span style={{ color: contentColor(attrs.color), fontSize: contentFontSize(attrs.fontSize) }}>{text}</span>;
    } else if (mark.type === "highlight") {
      const color = contentColor(attrs.color);
      text = <mark data-color={color} style={color ? { backgroundColor: color } : undefined}>{text}</mark>;
    }
  }
  return text;
}

function renderNode(node: ContentNode, key: string, depth = 0): ReactNode {
  if (!node || typeof node !== "object" || depth > 100) return null;
  if (node.type === "text") return <Fragment key={key}>{markedText(node)}</Fragment>;
  const attrs = node.attrs ?? {};
  const children = Array.isArray(node.content) ? node.content.map((child, index) => renderNode(child, `${key}.${index}`, depth + 1)) : [];
  switch (node.type) {
    case "doc": return <Fragment key={key}>{children}</Fragment>;
    case "paragraph": return <p key={key}>{children}{!children.length || node.content?.at(-1)?.type === "hardBreak" ? <br className="ProseMirror-trailingBreak" /> : null}</p>;
    case "heading": return createElement(`h${Math.min(6, Math.max(1, Math.trunc(Number(attrs.level)) || 1))}`, { key }, children);
    case "bulletList": return <ul key={key}>{children}</ul>;
    case "orderedList": return <ol key={key} start={attrs.start != null && Number.isFinite(Number(attrs.start)) ? Number(attrs.start) : 1}>{children}</ol>;
    case "listItem": return <li key={key}>{children}</li>;
    case "blockquote": return <blockquote key={key}>{children}</blockquote>;
    case "hardBreak": return <br key={key} />;
    case "horizontalRule": return <hr key={key} />;
    case "codeBlock": return <pre key={key}><code className={typeof attrs.language === "string" ? `language-${attrs.language}` : undefined}>{children}</code></pre>;
    case "image":
    case "imageResize": {
      const src = contentUrl(attrs.src, true);
      if (!src) return null;
      const style = imageLayoutStyle(attrs.containerStyle);
      // ResizeImage's read-only view returns its container and clamps pixel
      // widths to the editor's configured 80–900 range (default: 900).
      const pixelWidth = typeof style.width === "string" ? style.width.match(/^([\d.]+)(?:px)?$/)?.[1] : undefined;
      const width = Math.min(900, Math.max(80, Number(pixelWidth ?? 900)));
      return <div key={key} style={{ ...style, width }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={textAttribute(attrs.alt) ?? ""} title={textAttribute(attrs.title)} width={width} height={Number(attrs.height) || undefined} style={{ width }} loading="lazy" decoding="async" />
      </div>;
    }
    case "youtube": {
      const src = youtubeEmbedUrl(attrs.src, attrs.start);
      return src ? <div key={key} data-youtube-video=""><iframe src={src} title="YouTube 영상" width={Number(attrs.width) || 480} height={Number(attrs.height) || 270} allowFullScreen loading="lazy" className="my-4 rounded" /></div> : null;
    }
    case "embed": {
      const url = contentUrl(attrs.url);
      if (!url) return null;
      if (attrs.type === "twitter" || attrs.type === "instagram") return <ReadOnlyEmbed key={`${key}:${url}`} url={url} provider={attrs.type} />;
      return <div key={key} data-embed-url={url} data-embed-type="generic" className="embed-block my-4 rounded border border-border bg-surface-muted p-3"><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></div>;
    }
    case "poll": {
      const options: PollOption[] = Array.isArray(attrs.options) ? attrs.options.filter((option): option is PollOption => Boolean(option) && typeof option === "object" && typeof option.id === "string" && typeof option.label === "string") : [];
      return <div key={key} data-node-view-wrapper="" style={{ whiteSpace: "normal" }}><PollVoter pollId={textAttribute(attrs.pollId) ?? ""} question={textAttribute(attrs.question) ?? ""} options={options} /></div>;
    }
    default: return <Fragment key={key}>{children}</Fragment>;
  }
}

// Only polls and social embeds need browser code; reading a stored document
// must not download or initialize a full editing runtime.
export function PostContentViewer({ content }: { content: string }) {
  const document = contentDocument(content);
  if (!document) return <div className="whitespace-pre-wrap text-base leading-7">{content}</div>;
  return <div><div translate="no" className="tiptap ProseMirror community-prose max-w-none text-base leading-7">{renderNode(document, "doc")}</div></div>;
}
