"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FanFeedTabs, buildOwnerTabs } from "@/components/fan/fan-feed-tabs";
import {
  InstagramIcon,
  InstagramPostModal,
  proxyUrl,
  relativeTime,
} from "@/components/fan/instagram-post-modal";
import { preloadImage } from "@/lib/preload-image";
import type { InstagramStory, Player, PlayerSocialPost, TeamSocialPost } from "@/lib/types";

// ─── 타입 ──────────────────────────────────────────────────────

type PostItem = {
  id: string;
  ownerType: "team" | "player";
  ownerName: string;
  caption: string;
  imageUrl?: string;
  sourceUrl: string;
  postedAt?: string;
  likesCount?: number;
};

type StoryItem = InstagramStory & { ownerName: string; ownerImageUrl?: string };

// ─── 유틸 ──────────────────────────────────────────────────────

function preloadPostImages(posts: PostItem[]) {
  const urls = posts.flatMap((post) => {
    const url = proxyUrl(post.imageUrl);
    return url ? [url] : [];
  });
  return Promise.all(urls.map(preloadImage));
}

// ─── 스토리 뷰어 (모달) ─────────────────────────────────────────

function StoryViewer({
  stories,
  startIndex,
  onClose,
}: {
  stories: StoryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const story = stories[index];
  if (!story) return null;

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(stories.length - 1, i + 1));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90dvh] max-w-sm w-full flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 진행 바 */}
        <div className="flex gap-1 px-2 pt-2">
          {stories.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full ${i <= index ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-white/20 overflow-hidden">
            {story.ownerImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={proxyUrl(story.ownerImageUrl)} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <span className="text-sm font-bold text-white">{story.ownerName}</span>
          <span className="ml-auto text-[13px] text-white/60" suppressHydrationWarning>{relativeTime(story.takenAt)}</span>
          <button type="button" onClick={onClose} className="ml-2 text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 미디어 */}
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
          {story.mediaType === "video" ? (
            <video
              src={proxyUrl(story.mediaUrl)}
              poster={proxyUrl(story.thumbnailUrl)}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxyUrl(story.mediaUrl)} alt="" className="h-full w-full object-contain" />
          )}

          {/* 이전/다음 */}
          {index > 0 && (
            <button
              type="button"
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              ‹
            </button>
          )}
          {index < stories.length - 1 && (
            <button
              type="button"
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            >
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 스토리 버블 ─────────────────────────────────────────────────

function StoryBubble({ story, onClick }: { story: StoryItem; onClick: () => void }) {
  const isVideo = story.mediaType === "video";
  const previewUrl = proxyUrl(story.thumbnailUrl ?? story.mediaUrl);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 shrink-0"
    >
      <div className="relative h-16 w-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
        <div className="h-full w-full rounded-full overflow-hidden border-2 border-surface bg-surface-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-surface-muted" />
          )}
        </div>
        {isVideo && (
          <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[13px] text-white">
            ▶
          </span>
        )}
      </div>
      <span className="w-16 truncate text-center text-[13px] font-semibold">{story.ownerName}</span>
    </button>
  );
}

// ─── 게시물 카드 ─────────────────────────────────────────────────

function PostCard({
  item,
  onClick,
  compact = false,
  profileGrid = false,
}: {
  item: PostItem;
  onClick: () => void;
  compact?: boolean;
  profileGrid?: boolean;
}) {
  if (profileGrid) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative aspect-square overflow-hidden bg-[#efefef]"
        aria-label={`${item.ownerName} Instagram 게시물 열기`}
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyUrl(item.imageUrl)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center">
            <InstagramIcon className="h-8 w-8 text-[#a8a8a8]" />
          </span>
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/45 text-white group-hover:flex">
          {item.likesCount ? (
            <span className="text-sm font-black">♥ {item.likesCount.toLocaleString()}</span>
          ) : (
            <InstagramIcon className="h-6 w-6" />
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block aspect-square w-full overflow-hidden bg-[var(--ui-surface-muted)] text-left"
    >
      {/* 이미지 */}
      <div className="absolute inset-0 overflow-hidden bg-[var(--ui-surface-muted)]">
        <InstagramIcon className="absolute right-2.5 top-2.5 z-20 h-4 w-4 text-white drop-shadow" />
        {item.postedAt ? (
          <span
            className="absolute left-2 top-2 z-20 bg-black/70 px-2 py-1 text-[11px] font-bold leading-none text-white shadow-sm backdrop-blur"
            suppressHydrationWarning
          >
            {relativeTime(item.postedAt)}
          </span>
        ) : null}
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyUrl(item.imageUrl)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <InstagramIcon className="h-8 w-8 text-[var(--ui-muted)]" />
          </div>
        )}
        {/* 임베드 힌트 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
          <span className="bg-white/95 px-3.5 py-1.5 text-[12px] font-bold text-black">
            게시물 보기
          </span>
        </div>
      </div>

      {/* 하단: 좋아요·시간 + 캡션 */}
      <div className={compact ? "hidden" : "absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1 bg-black/72 px-3 py-2.5 text-white"}>
        <div className="hidden items-center gap-2 text-[12px] text-white/85">
          {!compact && item.likesCount ? (
            <span className="font-bold text-[var(--ui-ink)]">♥ {item.likesCount.toLocaleString()}</span>
          ) : null}
          <span className="ml-auto shrink-0 whitespace-nowrap" suppressHydrationWarning>
            {relativeTime(item.postedAt)}
          </span>
        </div>
        {!compact ? (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-white">
            <span className="mr-1.5 font-bold text-white">{item.ownerName}</span>
            {item.caption}
          </p>
        ) : null}
      </div>
    </button>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────

export function FanInstagramFeed({
  teamSlug,
  teamName,
  teamPosts,
  playerPosts,
  stories,
  players,
  variant = "full",
}: {
  teamSlug: string;
  teamName: string;
  teamLogoUrl?: string;
  teamInstagramUrl?: string | null;
  teamPosts: TeamSocialPost[];
  playerPosts: PlayerSocialPost[];
  stories: InstagramStory[];
  players: Player[];
  variant?: "preview" | "full";
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [embedPostIndex, setEmbedPostIndex] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState("all");
  const INITIAL_LIMIT = variant === "preview" ? 4 : 12;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const [isTabPending, setIsTabPending] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabLockRef = useRef(false);
  const tabUnlockTimerRef = useRef<number | null>(null);

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  // 게시물 통합 정렬 — 무한스크롤 effect 의존성으로 쓰이므로 참조를 안정화한다.
  const posts: PostItem[] = useMemo(
    () =>
      [
        ...teamPosts.map((p) => ({
          id: `team-${p.id}`,
          ownerType: "team" as const,
          ownerName: teamName,
          caption: p.content || p.title,
          imageUrl: p.thumbnailUrl,
          sourceUrl: p.sourceUrl,
          postedAt: p.publishedAt,
          likesCount: undefined,
        })),
        ...playerPosts.map((p) => ({
          id: `player-${p.id}`,
          ownerType: "player" as const,
          ownerName: playersById.get(p.playerId)?.name ?? "선수",
          caption: p.caption,
          imageUrl: p.imageUrl,
          sourceUrl: p.sourceUrl,
          postedAt: p.postedAt,
          likesCount: p.likesCount,
        })),
      ].sort((a, b) => {
        const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return tb - ta;
      }),
    [teamPosts, playerPosts, playersById, teamName],
  );

  // 스토리에 ownerName 붙이기
  const storyItems: StoryItem[] = stories.map((s) => ({
    ...s,
    ownerName:
      s.ownerType === "team"
        ? teamName
        : (playersById.get(s.ownerId)?.name ?? "선수"),
  }));

  // 탭 필터링 (전체 / 구단 / 선수 개개인) — 전체 보기에서만 노출
  const tabs = buildOwnerTabs(posts, teamName);

  const filteredPosts = useMemo(
    () =>
      activeKey === "all" ? posts : posts.filter((p) => p.ownerName === activeKey),
    [posts, activeKey],
  );
  const filteredStories =
    activeKey === "all" ? storyItems : storyItems.filter((s) => s.ownerName === activeKey);

  const hasStories = filteredStories.length > 0;
  const hasPosts = filteredPosts.length > 0;
  const visiblePosts = filteredPosts.slice(0, visibleCount);

  // 다음 탭의 첫 화면 이미지를 먼저 받은 뒤 완성된 화면으로 교체한다.
  const handleTabChange = async (key: string) => {
    if (key === activeKey || tabLockRef.current) return;

    tabLockRef.current = true;
    setIsTabPending(true);
    const nextPosts = key === "all" ? posts : posts.filter((post) => post.ownerName === key);
    await preloadPostImages(nextPosts.slice(0, INITIAL_LIMIT));
    setActiveKey(key);
    setVisibleCount(INITIAL_LIMIT);

    tabUnlockTimerRef.current = window.setTimeout(() => {
      tabLockRef.current = false;
      setIsTabPending(false);
      tabUnlockTimerRef.current = null;
    }, 0);
  };

  useEffect(() => {
    return () => {
      if (tabUnlockTimerRef.current !== null) {
        window.clearTimeout(tabUnlockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (variant !== "full" || visibleCount >= filteredPosts.length) return;

    const target = sentinelRef.current;
    if (!target) return;

    // cancelled: 탭 전환 등으로 effect가 정리되면 진행 중이던 배치 결과를 버린다.
    // loading: 같은 화면에서 옵저버가 연속 발화해도 한 번만 불러온다.
    let cancelled = false;
    let loading = false;

    const loadNextBatch = async () => {
      if (loading) return;
      loading = true;
      setIsBatchLoading(true);

      const nextCount = Math.min(filteredPosts.length, visibleCount + 12);
      await preloadPostImages(filteredPosts.slice(visibleCount, nextCount));
      if (cancelled) return;

      setIsBatchLoading(false);
      setVisibleCount(nextCount);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        void loadNextBatch();
      },
      { rootMargin: "120px 0px" },
    );

    observer.observe(target);
    return () => {
      cancelled = true;
      observer.disconnect();
      setIsBatchLoading(false);
    };
  }, [filteredPosts, variant, visibleCount]);

  return (
    <section className={variant === "full" ? "" : "fan-card rounded-3xl"}>
      {/* 프리뷰 헤더 (전체 보기에서는 페이지가 헤더를 가진다) */}
      {variant === "preview" ? (
        <div className="flex items-center justify-between gap-4 p-5 md:px-6">
          <div className="flex items-center gap-2">
            <InstagramIcon className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-bold tracking-[-0.01em]">인스타그램</h2>
            {hasStories && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[13px] font-bold text-accent">
                스토리 {storyItems.length}
              </span>
            )}
          </div>
          <Link
            href={`/fan/${teamSlug}/instagram`}
            className="rounded-full border border-[#dfe3ea] px-4 py-2 text-sm font-bold text-[#475467] transition hover:border-accent hover:text-accent"
          >
            전체 보기 →
          </Link>
        </div>
      ) : null}

      {/* 탭 필터 (전체 / 구단 / 선수 개개인) */}
      {variant === "full" ? (
        <FanFeedTabs
          tabs={tabs}
          activeKey={activeKey}
          onChange={handleTabChange}
          isPending={isTabPending}
        />
      ) : null}

      {/* 스토리 버블 */}
      {hasStories && (
        <div className={variant === "full" ? "mb-8" : "border-t border-[#eceef2] px-5 py-4 md:px-6"}>
          <p className="mb-3 text-[13px] font-bold text-muted uppercase tracking-wide">스토리</p>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {filteredStories.map((story, i) => (
              <StoryBubble
                key={story.id}
                story={story}
                onClick={() => setViewerIndex(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 게시물 그리드 */}
      <div
        aria-busy={isTabPending || isBatchLoading}
        className={variant === "full" ? "" : `border-t border-[#eceef2] p-5 md:p-6 ${hasStories ? "border-t" : ""}`}
      >
        {hasPosts ? (
          <>
            {variant === "preview" ? (
              <p className="mb-3 text-[13px] font-bold text-muted uppercase tracking-wide">게시물</p>
            ) : null}
            <div
              className={
                variant === "full"
                  ? "grid grid-cols-3 gap-px bg-white sm:grid-cols-3 lg:grid-cols-3"
                  : "grid grid-cols-2 gap-3 sm:grid-cols-4"
              }
            >
              {visiblePosts.map((item, index) => (
                <PostCard
                  key={item.id}
                  item={item}
                  compact={variant === "preview"}
                  onClick={() => setEmbedPostIndex(index)}
                />
              ))}
            </div>
            {variant === "full" && filteredPosts.length > visibleCount ? (
              <div
                ref={sentinelRef}
                data-testid="instagram-infinite-sentinel"
                className="grid h-24 place-items-center"
              >
                {isBatchLoading ? (
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#dbdbdb] border-t-[#262626]" />
                ) : (
                  <span className="sr-only">다음 게시물 준비</span>
                )}
              </div>
            ) : variant === "full" && filteredPosts.length > INITIAL_LIMIT ? (
              <p className="py-8 text-center text-[13px] text-[#8e8e8e]">모든 게시물을 확인했습니다.</p>
            ) : null}
          </>
        ) : !hasStories ? (
          <p className="py-16 text-center text-sm text-muted">아직 새 게시물이 없습니다.</p>
        ) : null}
      </div>

      {/* 스토리 뷰어 모달 */}
      {viewerIndex !== null && (
        <StoryViewer
          stories={filteredStories}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* 게시물 임베드 모달 */}
      {embedPostIndex !== null && (
        <InstagramPostModal
          items={filteredPosts}
          startIndex={embedPostIndex}
          onClose={() => setEmbedPostIndex(null)}
        />
      )}
    </section>
  );
}
