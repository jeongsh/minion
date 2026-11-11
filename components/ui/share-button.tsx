"use client";

import { Share2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";

/**
 * 현재 화면이나 지정한 경로를 공유한다. 터치 기기에서는 공유 시트를 열고,
 * 데스크톱이나 공유 시트가 없는 브라우저에서는 주소를 복사한 뒤 알림을 띄운다.
 */
export function ShareButton({ title, path, className = "" }: { title?: string; path?: string; className?: string }) {
  const { showToast } = useToast();

  const share = async () => {
    const url = path ? new URL(path, window.location.origin).toString() : window.location.href;
    // 데스크톱 브라우저도 navigator.share를 지원하지만 OS 공유 창은 링크 복사보다 번거롭다.
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: title ?? document.title, url }).catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast({ title: "링크를 복사했어요", tone: "success" });
    } catch {
      showToast({ title: "링크를 복사하지 못했어요", description: "주소창의 주소를 직접 복사해 주세요.", tone: "error" });
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[13px] font-medium text-[var(--ui-text)] transition-colors hover:bg-[var(--ui-surface-muted)] md:h-10 md:gap-2 md:px-4 md:text-sm ${className}`}
    >
      <Share2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
      공유
    </button>
  );
}
