"use client";

import { memo, useEffect, useRef, useState } from "react";

const scripts = new Map<string, Promise<void>>();

const EmbedMarkup = memo(function EmbedMarkup({ url, provider }: { url: string; provider: "twitter" | "instagram" }) {
  return provider === "twitter"
    ? <blockquote className="twitter-tweet"><a href={url}>{url}</a></blockquote>
    : <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14"><a href={url}>{url}</a></blockquote>;
});

function externalScript(src: string) {
  const pending = scripts.get(src);
  if (pending) return pending;
  const request = new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing) {
      const widgets = window as typeof window & { twttr?: { widgets?: unknown }; instgrm?: { Embeds?: unknown } };
      if (src.includes("twitter") ? widgets.twttr?.widgets : widgets.instgrm?.Embeds) { resolve(); return; }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Embed unavailable")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { script.remove(); reject(new Error("Embed unavailable")); };
    document.body.appendChild(script);
  });
  scripts.set(src, request);
  void request.catch(() => scripts.delete(src));
  return request;
}

export function ReadOnlyEmbed({ url, provider }: { url: string; provider: "twitter" | "instagram" }) {
  const root = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let cancelled = false;
    let started = false;
    const frameSizes = new ResizeObserver(() => {
      const frame = element.querySelector("iframe");
      if (frame && frame.getBoundingClientRect().height > 0) {
        element.style.minHeight = "";
      }
    });
    const readyObserver = new MutationObserver(() => {
      const frame = element.querySelector("iframe");
      if (frame) { frameSizes.observe(frame); setStatus("ready"); }
    });
    readyObserver.observe(element, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => setStatus((current) => current === "loading" ? "error" : current), 12_000);
    const hydrate = async () => {
      if (started) return;
      started = true;
      try {
        await externalScript(provider === "twitter" ? "https://platform.twitter.com/widgets.js" : "https://www.instagram.com/embed.js");
        if (cancelled) return;
        const widgets = window as typeof window & {
          twttr?: { widgets?: { load: (element: HTMLElement) => void } };
          instgrm?: { Embeds?: { process: () => void } };
        };
        if (provider === "twitter") widgets.twttr?.widgets?.load(element);
        else widgets.instgrm?.Embeds?.process();
      } catch { setStatus("error"); }
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); void hydrate(); }
    }, { rootMargin: "600px" });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); readyObserver.disconnect(); frameSizes.disconnect(); window.clearTimeout(timeout); };
  }, [provider, url]);

  return <div ref={root} className="embed-block relative my-4 overflow-hidden rounded-lg" style={{ minHeight: status === "ready" ? undefined : 80, width: "fit-content", maxWidth: "100%" }} data-embed-url={url} data-embed-type={provider}>
    {status === "loading" ? <div className="community-media-placeholder absolute inset-0 z-10" role="status" aria-label="SNS 게시물 불러오는 중"><span className="community-media-spinner" aria-hidden="true" /></div> : null}
    {status === "error" ? <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 border border-[var(--ui-border)] bg-[var(--ui-surface-muted)]"><span className="text-[14px] font-medium text-[var(--ui-muted)]">게시물을 불러오지 못했습니다.</span><a className="text-[14px] font-medium text-[var(--accent)]" href={url} target="_blank" rel="noopener noreferrer">원문 보기</a></div> : null}
    <div className={status === "ready" ? "visible" : "invisible"}>
      <EmbedMarkup url={url} provider={provider} />
    </div>
  </div>;
}
