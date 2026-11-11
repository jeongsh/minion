"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";

/**
 * 현재 화면이나 지정한 경로를 공유한다. 공유 시트를 지원하면 시트를 열고,
 * 지원하지 않는 브라우저에서는 주소를 복사한다.
 */
export function ShareButton({ title, path, className = "" }: { title?: string; path?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    if (navigator.share) {
      await navigator.share({ title: title ?? document.title, url }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // 클립보드 권한이 없으면 조용히 넘어간다. 주소창의 주소는 그대로 복사할 수 있다.
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-muted)] md:h-10 md:gap-2 md:px-4 md:text-sm ${className}`}
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={1.8} aria-hidden /> : <Share2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
      {copied ? "링크 복사됨" : "공유"}
    </button>
  );
}
