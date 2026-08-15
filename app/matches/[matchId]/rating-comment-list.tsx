"use client";

import { ChevronDown, Flag, LoaderCircle, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { AuthorMenu } from "@/components/community/author-menu";
import { useToast } from "@/components/ui/toast";
import type { Tier } from "@/lib/rank/config";

import { reactFanRatingAction, reportFanRatingAction } from "./actions";

type ReactionState = "honor" | "dislike" | null;
const PAGE_SIZE = 5;

export type RatingCommentItem = {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  playerImageUrl: string | null;
  rating: number;
  review: string;
  authorId: string | null;
  authorName: string;
  authorImageUrl: string | null;
  authorTier: Tier;
  honorCount: number;
  dislikeCount: number;
  initialReaction: ReactionState;
};

function CommentActions({ item }: { item: RatingCommentItem }) {
  const { showToast } = useToast();
  const [reaction, setReaction] = useState<ReactionState>(item.initialReaction);
  const [honorCount, setHonorCount] = useState(item.honorCount);
  const [dislikeCount, setDislikeCount] = useState(item.dislikeCount);
  const [reported, setReported] = useState(false);
  const [pending, startTransition] = useTransition();

  const react = (kind: Exclude<ReactionState, null>) => {
    startTransition(async () => {
      const result = await reactFanRatingAction({ ratingId: item.id, matchId: item.matchId, kind });
      if (!result.ok) {
        showToast({ title: "반응 저장 실패", description: result.error, tone: "error" });
        return;
      }
      setReaction(result.state);
      setHonorCount(result.honorCount);
      setDislikeCount(result.dislikeCount);
    });
  };

  const report = () => {
    if (!window.confirm("선수 비방 또는 부적절한 내용으로 신고할까요?")) return;
    startTransition(async () => {
      const result = await reportFanRatingAction({ ratingId: item.id, matchId: item.matchId });
      if (!result.ok) {
        showToast({ title: "신고 실패", description: result.error ?? "신고를 접수하지 못했습니다.", tone: "error" });
        return;
      }
      setReported(true);
      showToast({ title: "신고 접수 완료", description: result.message, tone: "success" });
    });
  };

  const buttonClass = "inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-[13px] font-normal text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)] disabled:opacity-50";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      <button type="button" className={`${buttonClass} ${reaction === "honor" ? "text-[var(--tp)]" : ""}`} aria-pressed={reaction === "honor"} disabled={pending} onClick={() => react("honor")}>
        <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" /> 좋아요 {honorCount}
      </button>
      <button type="button" className={`${buttonClass} ${reaction === "dislike" ? "text-[var(--tp)]" : ""}`} aria-pressed={reaction === "dislike"} disabled={pending} onClick={() => react("dislike")}>
        <ThumbsDown aria-hidden="true" className="h-3.5 w-3.5" /> 싫어요 {dislikeCount}
      </button>
      <button type="button" className={buttonClass} disabled={pending || reported} onClick={report}>
        <Flag aria-hidden="true" className="h-3.5 w-3.5" /> {reported ? "신고됨" : "신고"}
      </button>
    </div>
  );
}

export function RatingCommentList({
  items,
  viewerId,
}: {
  items: RatingCommentItem[];
  viewerId?: string;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const players = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; imageUrl: string | null; count: number }>();
    for (const item of items) {
      const current = unique.get(item.playerId);
      unique.set(item.playerId, {
        id: item.playerId,
        name: item.playerName,
        imageUrl: item.playerImageUrl,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...unique.values()];
  }, [items]);
  const filteredItems = playerId ? items.filter((item) => item.playerId === playerId) : items;
  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredItems.length;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setLoading(true);
          timerRef.current = setTimeout(() => {
            setVisibleCount((count) => Math.min(count + PAGE_SIZE, filteredItems.length));
            setLoading(false);
          }, 450);
        }
      },
      { rootMargin: "120px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredItems.length, hasMore, loading, visibleCount]);

  if (items.length === 0) {
    return (
      <>
        <h3 className="text-base font-black text-[var(--ui-ink)]">평가 코멘트</h3>
        <p className="mt-2 text-sm font-normal text-[var(--ui-muted)]">아직 작성된 평가 코멘트가 없습니다.</p>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-[var(--ui-ink)]">평가 코멘트</h3>
        <label className="relative block min-w-0 shrink-0">
          <span className="sr-only">선수별 코멘트 필터</span>
          <select
            value={playerId ?? "all"}
            onChange={(event) => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setLoading(false);
              setVisibleCount(PAGE_SIZE);
              setPlayerId(event.target.value === "all" ? null : event.target.value);
            }}
            className="h-9 w-auto min-w-40 max-w-[55vw] appearance-none truncate rounded-lg bg-[var(--ui-card-bg)] py-0 pl-3 pr-9 text-sm font-normal text-[var(--ui-ink)] outline-none transition-colors hover:bg-[var(--ui-card-hover)] focus-visible:ring-2 focus-visible:ring-[var(--tp)]"
          >
            <option value="all">전체 선수 ({items.length})</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.count})
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ui-muted)]" />
        </label>
      </div>

      <div className="mt-2 grid gap-3">
        {visibleItems.map((item) => (
          <article key={item.id} className="flex min-w-0 gap-3 rounded-xl bg-[var(--ui-card-bg)] p-3.5 sm:p-4">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <AuthorMenu
                  authorId={item.authorId}
                  authorName={item.authorName}
                  authorImageUrl={item.authorImageUrl}
                  authorTier={item.authorTier}
                  viewerId={viewerId}
                  variant="comment"
                />
                <span className="inline-flex items-center gap-1.5 rounded bg-[var(--ui-surface)] py-0.5 pl-0.5 pr-1.5 text-xs font-normal text-[var(--ui-muted)]">
                  <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {item.playerImageUrl ? <img src={item.playerImageUrl} alt="" className="h-full w-full object-cover object-top" /> : null}
                  </span>
                  {item.playerName}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1 text-[15px] font-bold tabular-nums text-[var(--ui-ink)]">
                  <Star aria-hidden="true" className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {item.rating.toFixed(1)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ui-text)] [overflow-wrap:anywhere] sm:text-[15px]">{item.review}</p>
              <CommentActions item={item} />
            </div>
          </article>
        ))}
      </div>
      {hasMore ? (
        <div ref={sentinelRef} className="flex min-h-11 items-center justify-center gap-1.5 text-xs font-medium text-[var(--ui-muted)]" aria-live="polite">
          {loading ? (
            <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />불러오는 중</>
          ) : (
            <><ChevronDown aria-hidden="true" className="h-4 w-4" />아래로 스크롤해 더 보기</>
          )}
        </div>
      ) : null}
    </>
  );
}
