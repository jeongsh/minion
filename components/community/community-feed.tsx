"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PostGallery } from "@/components/community/post-gallery";
import { PostList } from "@/components/community/post-list";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import { hotScore, isHotPost } from "@/lib/community/hot";
import type { CommunityPostDetail } from "@/lib/community/types";

type ViewMode = "list" | "gallery";

const VIEW_STORAGE_KEY = "community:view:v2";
// "인기"는 말머리(board_type)가 아니라 정렬 필터.
const HOT = "__hot__";
const PAGE_SIZE = 15;

// 단일 피드 — 핸드오프 2c. 말머리 칩 + 검색 + 글쓰기 + 테이블.
export function CommunityFeed({
  posts,
  scope,
  teamSlug,
  newPath,
}: {
  posts: CommunityPostDetail[];
  scope: BoardScope;
  teamSlug?: string;
  newPath: string;
}) {
  const categories = categoriesForScope(scope);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    // 저장된 보기 설정은 마운트 후에만 읽는다(SSR 하이드레이션 불일치 방지).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "gallery") setView(saved);
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
  };

  const filtered = useMemo(() => {
    const base =
      activeCategory === HOT
        ? posts
            .filter(isHotPost)
            .sort((a, b) => hotScore(b) - hotScore(a) || b.likeCount - a.likeCount)
        : activeCategory
          ? posts.filter((p) => p.boardType === activeCategory)
          : posts;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.authorName ?? "").toLowerCase().includes(q),
    );
  }, [posts, activeCategory, query]);

  // 필터/검색 변경 시 첫 페이지로.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [activeCategory, query, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged =
    view === "list"
      ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
      : filtered;

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-[7px] text-[14px] font-semibold transition-colors ${
      active
        ? "bg-[var(--ink,#16151b)] text-[var(--background)]"
        : "bg-[var(--surface-1,#f2f0ec)] text-[var(--ink-2,#6d6c76)] hover:bg-[var(--surface-1-hover,#e9e6e1)]"
    }`;

  const hotChip = (active: boolean) =>
    `rounded-full px-3.5 py-[7px] text-[14px] font-semibold transition-colors ${
      active
        ? "bg-[var(--tp)] text-white"
        : "bg-[var(--surface-1,#f2f0ec)] text-[var(--tp)] hover:bg-[var(--surface-1-hover,#e9e6e1)]"
    }`;

  const toggleBtn = (active: boolean) =>
    `px-3 py-[7px] text-[14px] ${
      active ? "bg-[var(--surface-1,#f2f0ec)] font-bold text-[var(--ink,#16151b)]" : "text-[var(--sub-muted,#9c9aa3)]"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* 필터 줄 */}
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

        <div className="flex items-center gap-2.5">
          <label className="flex h-[38px] w-[220px] items-center gap-2 rounded-full border border-[var(--input-border,#e5e3df)] bg-surface px-4 text-[14px] max-sm:w-[160px]">
            <span aria-hidden className="text-[var(--sub-muted,#9c9aa3)]">⌕</span>
            <span className="sr-only">게시글 검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="제목, 글쓴이 검색"
              className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-[var(--sub-muted-weak,#b6b4bd)]"
            />
          </label>

          <div
            className="hidden shrink-0 overflow-hidden rounded-full border border-[var(--btn-border,#e3e0da)] sm:flex"
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
              className={`border-l border-[var(--btn-border,#e3e0da)] ${toggleBtn(view === "gallery")}`}
            >
              갤러리
            </button>
          </div>

        </div>
      </div>

      {view === "list" ? (
        <>
          <PostList posts={paged} scope={scope} teamSlug={teamSlug} />
          {totalPages > 1 ? (
            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
          ) : null}
        </>
      ) : (
        <PostGallery posts={paged} scope={scope} teamSlug={teamSlug} />
      )}

      <div className="flex justify-end">
        <Link
          href={newPath}
          className="inline-flex h-[38px] items-center gap-1 rounded-full bg-[var(--tp)] px-[18px] text-[14px] font-bold text-white transition-opacity hover:opacity-90"
        >
          ＋ 글쓰기
        </Link>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  return (
    <nav className="flex items-center justify-center gap-1.5 pt-2" aria-label="페이지네이션">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`grid h-9 min-w-9 place-items-center rounded-[10px] px-2 text-[14px] font-semibold transition-colors ${
            p === page
              ? "bg-[var(--ink,#16151b)] text-white"
              : "text-[var(--ink-2,#6d6c76)] hover:bg-[var(--surface-1,#f2f0ec)]"
          }`}
        >
          {p}
        </button>
      ))}
      {page < totalPages ? (
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          className="grid h-9 place-items-center rounded-[10px] px-3 text-[14px] font-semibold text-[var(--ink-2,#6d6c76)] hover:bg-[var(--surface-1,#f2f0ec)]"
        >
          다음 →
        </button>
      ) : null}
    </nav>
  );
}
