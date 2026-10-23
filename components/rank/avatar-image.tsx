"use client";

import { useEffect, useState } from "react";

export function AvatarImage({ src, alt }: { src: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!failed) return;
    const retry = () => { setFailed(false); setAttempt((value) => value + 1); };
    const onVisible = () => { if (document.visibilityState === "visible") retry(); };
    const timer = attempt < 2 ? window.setTimeout(retry, 1000 * (attempt + 1)) : undefined;
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [attempt, failed]);

  // Remount the failed request without modifying signed or blob URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={attempt} src={src} alt={alt} onLoad={() => { setLoaded(true); setFailed(false); }} onError={() => { setLoaded(false); setFailed(true); }} className="absolute inset-0 h-full w-full bg-[var(--ui-surface-muted)] object-cover" style={{ opacity: loaded && !failed ? 1 : 0 }} />;
}
