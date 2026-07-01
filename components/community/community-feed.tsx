"use client";

import { useEffect, useMemo, useState } from "react";

import { PostGallery } from "@/components/community/post-gallery";
import { PostList } from "@/components/community/post-list";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import { hotScore, isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

type ViewMode = "list" | "gallery";

const VIEW_STORAGE_KEY = "community:view";
// "인기"는 말머리(board_type)가 아니라 정렬 필터.
const HOT = "__hot__";

// 단일 피드 — 시안 1b. 정확값 동기화 버전.
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
      // 기준(명예+댓글) 미달 글은 제외하고, 인기 점수순으로 정렬.
      return posts
        .filter(isHotPost)
        .sort((a, b) => hotScore(b) - hotScore(a) || b.likeCount - a.likeCount);
    }
    return activeCategory ? posts.filter((p) => p.boardType === activeCategory) : posts;
  }, [posts, activeCategory]);

  const chip = (active: boolean) =>
    `rounded-full px-3 py-[7px] text-[12px] font-semibold transition-colors ${
      active ? "bg-[#111827] text-white" : "bg-[#f1f4f9] text-[#56607a] hover:bg-[#e9edf4]"
    }`;

  const hotChip = (active: boolean) =>
    `rounded-full px-3 py-[7px] text-[12px] font-semibold transition-colors ${
      active ? "bg-accent text-accent-foreground" : "bg-[#f1f4f9] text-accent hover:bg-[#e9edf4]"
    }`;

  const toggleBtn = (active: boolean) =>
    `px-3 py-[8px] text-[12px] ${
      active ? "bg-[#eef2f7] font-bold text-[#111827]" : "bg-white text-[#8a93a6]"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-[6px]" role="tablist" aria-label="말머리 필터">
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === null}
            onClick={() => setActiveCategory(null)}
            className={chip(activeCategory === null)}
          >
            전체
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === HOT}
            onClick={() => setActiveCategory(HOT)}
            className={hotChip(activeCategory === HOT)}
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
              className={chip(activeCategory === cat.slug)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div
          className="flex shrink-0 overflow-hidden rounded-lg border border-[#e0e5ee]"
          role="group"
          aria-label="보기 방식"
        >
          <button type="button" onClick={() => changeView("list")} aria-pressed={view === "list"} className={toggleBtn(view === "list")}>
            목록
          </button>
          <button
            type="button"
            onClick={() => changeView("gallery")}
            aria-pressed={view === "gallery"}
            className={`border-l border-[#e0e5ee] ${toggleBtn(view === "gallery")}`}
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
