"use client";
import { ChevronDown } from "lucide-react";

import { FilterDropdown } from "@/components/match-filter-dropdown";

import { Flag, LoaderCircle, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { AuthorMenu } from "@/components/community/author-menu";
import { useToast } from "@/components/ui/toast";
import { formatFanRating } from "@/lib/fan-rating-display";
import type { Tier } from "@/lib/rank/config";

import { loadMatchRatingCommentsAction, reactFanRatingAction, reportFanRatingAction } from "./actions";
import type { PlayerReviewCursor } from "@/lib/data/lck";

type ReactionState = "honor" | "dislike" | null;

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
        showToast({ title: result.error, tone: "error" });
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
        showToast({ title: result.error ?? "신고를 접수하지 못했습니다.", tone: "error" });
        return;
      }
      setReported(true);
      showToast({ title: result.message ?? "신고가 접수되었습니다.", tone: "success" });
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
  initialPage,
  matchId,
  setId,
  players,
  viewerId,
}: {
  initialPage: { items: RatingCommentItem[]; nextCursor: PlayerReviewCursor | null };
  matchId: string;
  setId: string;
  players: { id: string; name: string; count: number }[];
  viewerId?: string;
}) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  const total = players.reduce((sum, player) => sum + player.count, 0);
  const hasMore = Boolean(page.nextCursor);
  async function load(selected: string | null, append: boolean) {
    if (append && busy.current) return;
    const id = ++requestId.current;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const next = await loadMatchRatingCommentsAction(matchId, setId, selected, append ? page.nextCursor : null);
      if (id !== requestId.current) return;
      setPage(current => ({ ...next, items: append ? [...current.items, ...next.items.filter(item => !current.items.some(old => old.id === item.id))] : next.items }));
      setPlayerId(selected);
    } catch (caught) {
      if (id === requestId.current) setError(caught instanceof Error ? caught.message : "코멘트를 불러오지 못했습니다.");
    } finally {
      if (id === requestId.current) { busy.current = false; setLoading(false); }
    }
  }

  useEffect(() => () => {
    requestId.current += 1;
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading || error) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          void load(playerId, true);
        }
      },
      { rootMargin: "120px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  // load uses the current cursor and selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.nextCursor, hasMore, loading, error, playerId]);

  if (total === 0 && page.items.length === 0) {
    return (
      <>
        <h3 className="text-[14px] font-medium text-[var(--ui-ink)] sm:text-base sm:font-black">평가 코멘트</h3>
        <p className="mt-2 text-sm font-normal text-[var(--ui-muted)]">아직 작성된 평가 코멘트가 없습니다.</p>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-medium text-[var(--ui-ink)] sm:text-base sm:font-black">평가 코멘트</h3>
        <FilterDropdown ariaLabel="선수별 코멘트 필터" selected={playerId ?? "all"} options={[{value:"all",label:"전체 선수 ("+total+")"},...players.map(player=>({value:player.id,label:player.name+" ("+player.count+")"}))]} onSelect={value => void load(value === "all" ? null : value, false)} rootClassName="min-w-40 max-w-[55vw]" triggerClassName="w-full" />
      </div>

      <div className="mt-2 grid gap-3">
        {page.items.map((item) => (
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
                  {formatFanRating(item.rating)}
                </span>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--ui-text)] [overflow-wrap:anywhere] sm:text-[15px]">{item.review}</p>
              <CommentActions item={item} />
            </div>
          </article>
        ))}
      </div>
      {error ? <button type="button" onClick={() => void load(playerId, true)} className="mt-3 text-sm text-[var(--ui-muted)]">{error} 다시 시도</button> : null}
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
