"use client";

import { useEffect, useMemo, useState } from "react";

import { PostGallery } from "@/components/community/post-gallery";
import { PostList } from "@/components/community/post-list";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import type { CommunityPostDetail } from "@/lib/community/types";

type ViewMode = "list" | "gallery";

const VIEW_STORAGE_KEY = "community:view";
// "인기"는 말머리(board_type)가 아니라 정렬 필터다. 별도 토큰으로 구분.
const HOT = "__hot__";

// 단일 피드 — 말머리 칩(전체/인기 + 보드들) + 목록/갤러리 토글.
// 색상은 토큰만 사용 → 팀 프라이머리(--accent)를 그대로 따른다.
export function CommunityFeed({
  posts,
  scope,
  teamSlug,
}: {
  posts: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
}) {
  const categories = categoriesForScope(scope);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    // 저장된 보기 설정은 마운트 후에만 읽는다(SSR 하이드레이션 불일치 방지).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "list" || saved === "gallery") setView(saved);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const filtered = useMemo(() => {
    if (activeCategory === HOT) {
      // 인기: 명예수 기준 정렬(동률은 댓글수). 모든 말머리 포함.
      return [...posts].sort(
        (a, b) => b.likeCount - a.likeCount || b.commentCount - a.commentCount,
      );
    }
    return activeCategory ? posts.filter((p) => p.boardType === activeCategory) : posts;
  }, [posts, activeCategory]);

  const chipClass = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-foreground text-background"
        : "bg-surface-muted text-muted hover:bg-border/60"
    }`;

  const hotChipClass = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-accent text-accent-foreground" : "bg-surface-muted text-accent hover:bg-border/60"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="말머리 필터">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={chipClass(activeCategory === null)}
          >
            전체
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === HOT}
            onClick={() => setActiveCategory(HOT)}
            className={hotChipClass(activeCategory === HOT)}
          >
            인기
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              role="tab"
              aria-selected={activeCategory === cat.slug}
              onClick={() => setActiveCategory(cat.slug)}
              className={chipClass(activeCategory === cat.slug)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div
          className="flex shrink-0 overflow-hidden rounded-lg border border-border"
          role="group"
          aria-label="보기 방식"
        >
          <button
            type="button"
            onClick={() => changeView("list")}
            aria-pressed={view === "list"}
            className={`px-3.5 py-2 text-sm ${
              view === "list" ? "bg-surface-muted font-semibold text-foreground" : "bg-surface text-muted"
            }`}
          >
            목록
          </button>
          <button
            type="button"
            onClick={() => changeView("gallery")}
            aria-pressed={view === "gallery"}
            className={`border-l border-border px-3.5 py-2 text-sm ${
              view === "gallery" ? "bg-surface-muted font-semibold text-foreground" : "bg-surface text-muted"
            }`}
          >
            갤러리
          </button>
        </div>
      </div>

      {view === "list" ? (
        <PostList posts={filtered} scope={scope} teamSlug={teamSlug} />
      ) : (
        <PostGallery posts={filtered} scope={scope} teamSlug={teamSlug} />
      )}
    </div>
  );
}
