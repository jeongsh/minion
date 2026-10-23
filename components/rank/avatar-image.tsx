"use client";

import { useCallback, useEffect, useState } from "react";

export function AvatarImage({ src, alt }: { src: string; alt: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const checkImage = useCallback((image: HTMLImageElement | null) => {
    // 캐시된 이미지는 이벤트 핸들러가 연결되기 전에 로딩을 마칠 수 있다.
    if (image?.complete) setFailed(image.naturalWidth === 0);
  }, []);

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
  return <img key={attempt} ref={checkImage} src={src} alt={alt} onLoad={() => setFailed(false)} onError={() => setFailed(true)} className="absolute inset-0 h-full w-full bg-[var(--ui-surface-muted)] object-cover" style={{ opacity: failed ? 0 : 1 }} />;
}
