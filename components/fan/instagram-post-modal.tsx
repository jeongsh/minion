"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";

// 인스타그램 게시물 임베드 모달. 팬 인스타 피드와 홈 FEED에서 공용으로 쓴다.

export type InstagramPostItem = {
  id: string;
  ownerName: string;
  caption: string;
  imageUrl?: string;
  sourceUrl: string;
  postedAt?: string;
  likesCount?: number;
};

export function proxyUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

export function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

function instagramEmbedUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;

    return `https://www.instagram.com/${match[1]}/${match[2]}/embed/captioned/`;
  } catch {
    return null;
  }
}

export function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

export function InstagramPostModal({
  items,
  startIndex,
  onClose,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
}: {
  items: InstagramPostItem[];
  startIndex: number;
  onClose: () => void;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  loadingMore?: boolean;
}) {
  const [index, setIndex] = useState(startIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [requestedIndex, setRequestedIndex] = useState<number | null>(null);
  if (requestedIndex !== null && requestedIndex < items.length) {
    setIndex(requestedIndex);
    setRequestedIndex(null);
    setIsLoading(true);
  }
  const item = items[index];
  const embedUrl = item ? instagramEmbedUrl(item.sourceUrl) : null;
  const hasPrevious = index > 0;
  const hasNext = index < items.length - 1 || hasMore;

  const moveTo = useCallback((nextIndex: number) => {
    if (nextIndex >= items.length) {
      if (hasMore && onLoadMore && !loadingMore) { setRequestedIndex(nextIndex); void onLoadMore(); }
      return;
    }
    if (nextIndex < 0) return;
    setIsLoading(true);
    setIndex(nextIndex);
  }, [items.length, hasMore, onLoadMore, loadingMore]);

  useEffect(() => {
    const handleArrow = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") moveTo(index - 1);
      if (event.key === "ArrowRight") moveTo(index + 1);
    };
    window.addEventListener("keydown", handleArrow);
    return () => window.removeEventListener("keydown", handleArrow);
  }, [index, moveTo]);

  if (!item) return null;

  return (
    <ControlledDialog open onClose={onClose} ariaLabel={item.ownerName + ' Instagram 게시물'} panelClassName="h-[92dvh] sm:max-w-[620px]">
      <DialogSheetHeader onClose={onClose} title={'@' + item.ownerName} actions={<Link href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--ui-muted)]">원문 ↗</Link>} />
      <div className={dialogBodyClassName + " flex flex-col"}>
        {item.postedAt ? <p className="mb-2 shrink-0 text-[13px] text-[var(--ui-muted)]" suppressHydrationWarning>{relativeTime(item.postedAt)}</p> : null}
        <div className="relative min-h-0 flex-1">
          <div className="relative h-full min-h-0 overflow-hidden bg-surface sm:rounded-b-2xl">
            {isLoading && embedUrl ? (
              <div className="absolute inset-0 z-0 grid place-items-center bg-surface">
                <div className="flex flex-col items-center gap-3 text-sm font-bold text-[#667085]">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#e4e7ec] border-t-accent" />
                  Instagram 게시물을 불러오는 중
                </div>
              </div>
            ) : null}

            {embedUrl ? (
              <iframe
                key={item.id}
                src={embedUrl}
                width="100%"
                height="720"
                className="relative z-10 h-full w-full border-0 bg-surface"
                scrolling="yes"
                allow="encrypted-media; picture-in-picture; web-share"
                allowFullScreen
                onLoad={() => setIsLoading(false)}
                title={`Instagram post by ${item.ownerName}`}
              />
            ) : (
              <div className="grid h-full place-items-center bg-surface p-8 text-center">
                <div>
                  <p className="text-sm font-bold text-[#344054]">이 게시물은 임베드로 표시할 수 없습니다.</p>
                  <Link
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[#111827] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    Instagram에서 보기 ↗
                  </Link>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="flex h-11 shrink-0 items-center border-t border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 text-[var(--ui-ink)]">
          <button
            type="button"
            onClick={() => moveTo(index - 1)}
            disabled={!hasPrevious}
            className="flex h-full flex-1 items-center justify-start gap-1 text-[13px] font-bold disabled:opacity-25"
            aria-label="이전 Instagram 게시물"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
            이전 게시물
          </button>
          <span className="shrink-0 px-3 text-[13px] font-black tabular-nums text-[var(--ui-muted)]">
            {index + 1} / {items.length}
          </span>
          <button
            type="button"
            onClick={() => moveTo(index + 1)}
            disabled={!hasNext}
            className="flex h-full flex-1 items-center justify-end gap-1 text-[13px] font-bold disabled:opacity-25"
            aria-label="다음 Instagram 게시물"
          >
            다음 게시물
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </ControlledDialog>
  );
}
