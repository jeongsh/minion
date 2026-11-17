"use client";

import Link from "next/link";
import { ChevronDown, LoaderCircle, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuthorMenu } from "@/components/community/author-menu";
import { formatFanRating } from "@/lib/fan-rating-display";
import { Button } from "@/components/ui/button";
import type { FanReviewItem, FanReviewPage } from "@/lib/player-reviews";

function FanReviewComment({ rating, meta, href }: FanReviewItem) {
  return (
    <article className="flex min-w-0 gap-3 rounded-xl bg-[var(--ui-card-bg)] p-3.5 sm:p-4">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <AuthorMenu
            authorId={rating.authorId}
            authorName={rating.authorNickname ?? "익명"}
            authorImageUrl={rating.authorProfileImageUrl}
            authorTier={rating.authorTier}
            variant="comment"
          />
          <span className="ml-auto flex shrink-0 items-center gap-1 text-base font-bold tabular-nums text-[var(--ui-ink)]">
            <Star aria-hidden="true" className="h-4 w-4 fill-amber-400 text-amber-400" />
            {formatFanRating(rating.rating)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-base leading-7 text-[var(--ui-text)] [overflow-wrap:anywhere] sm:mt-1.5">{rating.review}</p>
        {href ? (
          <Link href={href} className="mt-2 flex w-fit flex-wrap gap-x-2 text-[13px] font-medium text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]">
            {meta.map((part, index) => <span key={index}>{part}</span>)}
          </Link>
        ) : (
          <p className="mt-2 flex flex-wrap gap-x-2 text-[13px] font-medium text-[var(--ui-muted)]">{meta.map((part, index) => <span key={index}>{part}</span>)}</p>
        )}
      </div>
    </article>
  );
}

export function FanReviewList({ initialPage, playerSlug, segment }: {
  initialPage: FanReviewPage;
  playerSlug: string;
  segment: string;
}) {
  const [items, setItems] = useState(initialPage.items);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      const query = new URLSearchParams({ segment, cursor: JSON.stringify(nextCursor) });
      const response = await fetch(`/api/players/${encodeURIComponent(playerSlug)}/reviews?${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Player reviews request failed");
      const page: FanReviewPage = await response.json();
      if (controller.signal.aborted) return;
      setItems((current) => {
        const ids = new Set(current.map((item) => item.rating.id));
        return [...current, ...page.items.filter((item) => !ids.has(item.rating.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [nextCursor, playerSlug, segment]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || loading || error) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          void loadMore();
        }
      },
      { rootMargin: "120px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loading, error, loadMore]);

  return (
    <>
      <div className="grid gap-3">
        {items.map((item) => (
          <FanReviewComment key={item.rating.id} {...item} />
        ))}
      </div>
      {nextCursor ? (
        <div ref={sentinelRef} className="flex min-h-11 flex-wrap items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--ui-muted)]" aria-live="polite">
          {error ? (
            <><span>리뷰를 불러오지 못했습니다.</span><Button variant="secondary" className="border-0 bg-transparent" onClick={() => void loadMore()}>다시 시도</Button></>
          ) : loading ? (
            <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />불러오는 중</>
          ) : (
            <Button variant="secondary" className="gap-1.5 border-0 bg-transparent" onClick={() => void loadMore()}><ChevronDown aria-hidden="true" className="h-4 w-4" />아래로 스크롤해 더 보기</Button>
          )}
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        팬 리뷰 {items.length}개 표시 중
      </span>
    </>
  );
}
