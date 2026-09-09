"use client";

import { useEffect, useRef } from "react";

const scripts = new Map<string, Promise<void>>();

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
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let cancelled = false;
    let started = false;
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
      } catch { /* The server-rendered link remains available. */ }
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); void hydrate(); }
    }, { rootMargin: "600px" });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); };
  }, [provider, url]);

  return <div ref={root} className="embed-block my-4" data-embed-url={url} data-embed-type={provider}>
    {provider === "twitter" ? <blockquote className="twitter-tweet"><a href={url}>{url}</a></blockquote>
      : <blockquote className="instagram-media" data-instgrm-permalink={url} data-instgrm-version="14"><a href={url}>{url}</a></blockquote>}
  </div>;
}
