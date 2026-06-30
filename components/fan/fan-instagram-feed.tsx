"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FanFeedTabs, buildOwnerTabs } from "@/components/fan/fan-feed-tabs";
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

function proxyUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return `/api/proxy/image?url=${encodeURIComponent(url)}`;
}

function preloadPostImages(posts: PostItem[]) {
  const urls = posts.flatMap((post) => {
    const url = proxyUrl(post.imageUrl);
    return url ? [url] : [];
  });
  return Promise.all(urls.map(preloadImage));
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
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
          <span className="ml-auto text-xs text-white/60" suppressHydrationWarning>{relativeTime(story.takenAt)}</span>
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
          <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white">
            ▶
          </span>
        )}
      </div>
      <span className="w-16 truncate text-center text-[10px] font-semibold">{story.ownerName}</span>
    </button>
  );
}

// ─── 게시물 카드 ─────────────────────────────────────────────────

// ─── 게시물 임베드 모달 ──────────────────────────────────────────

function instagramEmbedUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;

    return `https://www.instagram.com/${match[1]}/${match[2]}/embed/`;
  } catch {
    return null;
  }
}

function PostEmbedModal({
  items,
  startIndex,
  onClose,
}: {
  items: PostItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [isLoading, setIsLoading] = useState(true);
  const item = items[index];
  const embedUrl = item ? instagramEmbedUrl(item.sourceUrl) : null;
  const hasPrevious = index > 0;
  const hasNext = index < items.length - 1;

  const moveTo = (nextIndex: number) => {
    setIsLoading(true);
    setIndex(nextIndex);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") {
        setIsLoading(true);
        setIndex((current) => Math.max(0, current - 1));
      }
      if (event.key === "ArrowRight") {
        setIsLoading(true);
        setIndex((current) => Math.min(items.length - 1, current + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [items.length, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-0 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.ownerName} Instagram 게시물`}
    >
      <div
        className="relative flex h-full w-full max-w-[1040px] flex-col sm:h-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 px-4 text-white sm:px-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
            <InstagramIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 sm:hidden">
            <p className="truncate text-sm font-black">@{item.ownerName}</p>
            <p className="text-xs text-white/55" suppressHydrationWarning>{relativeTime(item.postedAt)}</p>
          </div>
          <p className="hidden text-sm font-black sm:block">Instagram</p>
          <span className="ml-auto text-xs font-bold tabular-nums text-white/60">
            {index + 1} / {items.length}
          </span>
          <Link
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold transition hover:bg-white/20 sm:hidden"
          >
            원문 ↗
          </Link>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold transition hover:bg-white/20"
            aria-label="게시물 닫기"
          >
            ✕
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-visible sm:flex-none">
          <div className="grid h-full min-h-0 overflow-hidden bg-white sm:grid-cols-[minmax(0,560px)_minmax(300px,1fr)] sm:rounded-2xl">
            <div className="relative min-h-0 bg-white">
              {isLoading && embedUrl ? (
                <div className="absolute inset-0 z-0 grid place-items-center bg-white">
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
                  className="relative z-10 h-[calc(100dvh-64px)] w-full border-0 bg-white sm:h-[min(720px,calc(100dvh-112px))]"
                  scrolling="yes"
                  allow="encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                  onLoad={() => setIsLoading(false)}
                  title={`Instagram post by ${item.ownerName}`}
                />
              ) : (
                <div className="grid h-[calc(100dvh-64px)] place-items-center bg-white p-8 text-center sm:h-96">
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

            <aside className="hidden min-h-0 flex-col border-l border-[#eceef2] bg-white p-6 sm:flex">
              <div className="flex items-center gap-3 border-b border-[#eceef2] pb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <InstagramIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-[#101828]">@{item.ownerName}</p>
                  <p className="mt-0.5 text-xs text-[#98a2b3]" suppressHydrationWarning>{relativeTime(item.postedAt)}</p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-5 pr-1">
                <p className="whitespace-pre-line text-sm leading-6 text-[#344054]">
                  {item.caption || "게시물 설명이 없습니다."}
                </p>
                {item.likesCount !== undefined && item.likesCount > 0 ? (
                  <p className="mt-5 text-sm font-bold text-[#667085]">♥ {item.likesCount.toLocaleString()}</p>
                ) : null}
              </div>

              <Link
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 rounded-full bg-[#111827] px-4 py-3 text-center text-sm font-black text-white transition hover:bg-accent"
              >
                Instagram 원문 보기 ↗
              </Link>
            </aside>
          </div>

          <button
            type="button"
            onClick={() => moveTo(index - 1)}
            disabled={!hasPrevious}
            className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-3xl text-white shadow-lg backdrop-blur transition hover:bg-black disabled:pointer-events-none disabled:opacity-20 sm:-left-16"
            aria-label="이전 Instagram 게시물"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => moveTo(index + 1)}
            disabled={!hasNext}
            className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-3xl text-white shadow-lg backdrop-blur transition hover:bg-black disabled:pointer-events-none disabled:opacity-20 sm:-right-16"
            aria-label="다음 Instagram 게시물"
          >
            ›
          </button>
        </div>
      </div>
    </div>
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
      className="group block w-full overflow-hidden border border-[#e6e9ef] bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-black/5"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyUrl(item.imageUrl)}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <InstagramIcon className="h-8 w-8 text-muted/40" />
          </div>
        )}
        {/* 임베드 힌트 오버레이 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold text-black">
            게시물 보기
          </span>
        </div>
      </div>
      <div className={compact ? "p-3" : "flex h-[84px] flex-col p-3.5"}>
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted">
          <span className="truncate font-bold text-accent">@{item.ownerName}</span>
          <span className="shrink-0 whitespace-nowrap" suppressHydrationWarning>
            {!compact && item.likesCount ? `♥ ${item.likesCount.toLocaleString()} · ` : ""}
            {relativeTime(item.postedAt)}
          </span>
        </div>
        {!compact && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#262626]">{item.caption}</p>
        )}
      </div>
    </button>
  );
}

// ─── 아이콘 ─────────────────────────────────────────────────────

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
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
    <section className={variant === "full" ? "" : "rounded-3xl border border-[#e6e9ef] bg-white shadow-sm"}>
      {/* 프리뷰 헤더 (전체 보기에서는 페이지가 헤더를 가진다) */}
      {variant === "preview" ? (
        <div className="flex items-center justify-between gap-4 p-5 md:px-6">
          <div className="flex items-center gap-2">
            <InstagramIcon className="h-5 w-5 text-accent" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Social update</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.02em]">인스타그램</h2>
            </div>
            {hasStories && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
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
          <p className="mb-3 text-xs font-bold text-muted uppercase tracking-wide">스토리</p>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
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
              <p className="mb-3 text-xs font-bold text-muted uppercase tracking-wide">게시물</p>
            ) : null}
            <div
              className={
                variant === "full"
                  ? "grid items-start sm:grid-cols-2 lg:grid-cols-3"
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
              <p className="py-8 text-center text-xs text-[#8e8e8e]">모든 게시물을 확인했습니다.</p>
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
        <PostEmbedModal
          items={filteredPosts}
          startIndex={embedPostIndex}
          onClose={() => setEmbedPostIndex(null)}
        />
      )}
    </section>
  );
}
