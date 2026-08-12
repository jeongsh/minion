"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AuthorMenu } from "@/components/community/author-menu";
import type { FanRating } from "@/lib/types";

const PAGE_SIZE = 5;

export type FanReviewItem = {
  rating: FanRating;
  meta: string;
};

function FanReviewComment({ rating, meta }: FanReviewItem) {
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
          <span className="hidden text-xs text-[var(--ui-muted)] sm:inline">{meta}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-base font-bold tabular-nums text-[var(--ui-ink)]">
            <Star aria-hidden="true" className="h-4 w-4 fill-amber-400 text-amber-400" />
            {rating.rating.toFixed(1)}
          </span>
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ui-text)] [overflow-wrap:anywhere] sm:mt-1.5 sm:text-base sm:leading-7">{rating.review}</p>
        <p className="mt-2 text-xs text-[var(--ui-muted)] sm:hidden">{meta}</p>
      </div>
    </article>
  );
}

export function FanReviewList({ items }: { items: FanReviewItem[] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < items.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((count) => Math.min(count + PAGE_SIZE, items.length));
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, items.length, visibleCount]);

  return (
    <>
      <div className="grid gap-3">
        {items.slice(0, visibleCount).map((item) => (
          <FanReviewComment key={item.rating.id} {...item} />
        ))}
      </div>
      {hasMore ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
      <span className="sr-only" aria-live="polite">
        팬 리뷰 {Math.min(visibleCount, items.length)}개 표시 중
      </span>
    </>
  );
}
