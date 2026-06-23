"use client";

import Link from "next/link";
import { useState } from "react";

import type { InstagramStory, Player, PlayerSocialPost, TeamSocialPost } from "@/lib/types";

// ─── 타입 ──────────────────────────────────────────────────────

type PostItem = {
  id: string;
  ownerName: string;
  caption: string;
  imageUrl?: string;
  sourceUrl: string;
  postedAt?: string;
  likesCount?: number;
};

type StoryItem = InstagramStory & { ownerName: string; ownerImageUrl?: string };

// ─── 유틸 ──────────────────────────────────────────────────────

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
              <img src={story.ownerImageUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <span className="text-sm font-bold text-white">{story.ownerName}</span>
          <span className="ml-auto text-xs text-white/60" suppressHydrationWarning>{relativeTime(story.takenAt)}</span>
          <button type="button" onClick={onClose} className="ml-2 text-white/80 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 미디어 */}
        <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
          {story.mediaType === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={story.mediaUrl}
              poster={story.thumbnailUrl}
              autoPlay
              loop
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={story.mediaUrl} alt="" className="h-full w-full object-contain" />
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
  const previewUrl = story.thumbnailUrl ?? story.mediaUrl;

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

// ─── shortcode 추출 ─────────────────────────────────────────────

function extractShortcode(sourceUrl: string): string {
  return sourceUrl.match(/\/p\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
}

// ─── Instagram 임베드 모달 ────────────────────────────────────────

function EmbedModal({ item, onClose }: { item: PostItem; onClose: () => void }) {
  const shortcode = extractShortcode(item.sourceUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-8"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-[420px] flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 + 원본 링크 */}
        <div className="mb-2 flex w-full items-center justify-between gap-4">
          <Link
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
          >
            Instagram에서 보기 ↗
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
          >
            닫기 ✕
          </button>
        </div>

        {/* Instagram iframe 임베드 */}
        {shortcode ? (
          <iframe
            src={`https://www.instagram.com/p/${shortcode}/embed/`}
            width="100%"
            height="480"
            className="w-full rounded-xl border-0"
            scrolling="yes"
            allowTransparency
            allow="encrypted-media"
            title={`Instagram post by ${item.ownerName}`}
          />
        ) : (
          <div className="rounded-xl bg-surface p-8 text-sm text-muted">
            임베드를 불러올 수 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 게시물 카드 ─────────────────────────────────────────────────

function PostCard({ item, onClick }: { item: PostItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group block w-full overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-accent"
    >
      <div className="relative aspect-square overflow-hidden bg-surface-muted">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
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
      <div className="p-2.5">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="font-bold text-accent truncate">@{item.ownerName}</span>
          <span className="shrink-0" suppressHydrationWarning>{relativeTime(item.postedAt)}</span>
        </div>
        {item.likesCount !== undefined && item.likesCount > 0 && (
          <p className="mt-1 text-[11px] font-bold text-muted">
            ♥ {item.likesCount.toLocaleString()}
          </p>
        )}
        {item.caption && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed">{item.caption}</p>
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
  teamName,
  teamInstagramUrl,
  teamPosts,
  playerPosts,
  stories,
  players,
}: {
  teamName: string;
  teamInstagramUrl?: string | null;
  teamPosts: TeamSocialPost[];
  playerPosts: PlayerSocialPost[];
  stories: InstagramStory[];
  players: Player[];
}) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [embedPost, setEmbedPost] = useState<PostItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_LIMIT = 12;

  const playersById = new Map(players.map((p) => [p.id, p]));

  // 게시물 통합 정렬
  const posts: PostItem[] = [
    ...teamPosts.map((p) => ({
      id: `team-${p.id}`,
      ownerName: teamName,
      caption: p.content || p.title,
      imageUrl: p.thumbnailUrl,
      sourceUrl: p.sourceUrl,
      postedAt: p.publishedAt,
      likesCount: undefined,
    })),
    ...playerPosts.map((p) => ({
      id: `player-${p.id}`,
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
  });

  // 스토리에 ownerName 붙이기
  const storyItems: StoryItem[] = stories.map((s) => ({
    ...s,
    ownerName:
      s.ownerType === "team"
        ? teamName
        : (playersById.get(s.ownerId)?.name ?? "선수"),
  }));

  const hasStories = storyItems.length > 0;
  const hasPosts = posts.length > 0;

  return (
    <section className="rounded-md border border-border bg-surface shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-2">
          <InstagramIcon className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-black tracking-normal">인스타그램</h2>
          {hasStories && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">
              스토리 {storyItems.length}
            </span>
          )}
        </div>
        {teamInstagramUrl && (
          <Link
            href={teamInstagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-accent px-3 py-1.5 text-sm font-bold text-accent hover:bg-surface-muted"
          >
            팀 계정 →
          </Link>
        )}
      </div>

      {/* 스토리 버블 */}
      {hasStories && (
        <div className="border-t border-border px-5 py-4">
          <p className="mb-3 text-xs font-bold text-muted uppercase tracking-wide">스토리</p>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {storyItems.map((story, i) => (
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
      <div className={`border-t border-border p-5 ${hasStories ? "border-t" : ""}`}>
        {hasPosts ? (
          <>
            <p className="mb-3 text-xs font-bold text-muted uppercase tracking-wide">게시물</p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {(showAll ? posts : posts.slice(0, INITIAL_LIMIT)).map((item) => (
                <PostCard key={item.id} item={item} onClick={() => setEmbedPost(item)} />
              ))}
            </div>
            {posts.length > INITIAL_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-4 w-full rounded-md border border-border py-2.5 text-sm font-bold text-muted hover:border-accent hover:text-accent transition-colors"
              >
                {showAll ? "접기 ▲" : `더 보기 (${posts.length - INITIAL_LIMIT}개 더) ▼`}
              </button>
            )}
          </>
        ) : !hasStories ? (
          <p className="py-6 text-center text-sm text-muted">
            아직 동기화된 게시물이 없습니다.
            <br />
            <span className="mt-1 block text-xs">스크립트 관리에서 &quot;인스타그램 동기화&quot;를 실행해 주세요.</span>
          </p>
        ) : null}
      </div>

      {/* 스토리 뷰어 모달 */}
      {viewerIndex !== null && (
        <StoryViewer
          stories={storyItems}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* 게시물 임베드 모달 */}
      {embedPost && (
        <EmbedModal item={embedPost} onClose={() => setEmbedPost(null)} />
      )}
    </section>
  );
}
