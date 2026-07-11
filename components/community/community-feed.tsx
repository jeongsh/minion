"use client";

import { Search, SquarePen } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PostList } from "@/components/community/post-list";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import type { CommunityPostDetail } from "@/lib/community/types";

const PAGE_SIZE = 15;

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
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const byCategory = activeCategory
      ? posts.filter((post) => post.boardType === activeCategory)
      : posts;
    const keyword = submittedQuery.trim().toLocaleLowerCase("ko-KR");

    if (!keyword) return byCategory;
    return byCategory.filter((post) =>
      [post.title, post.excerpt, post.authorName ?? ""]
        .some((value) => value.toLocaleLowerCase("ko-KR").includes(keyword)),
    );
  }, [activeCategory, posts, submittedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section className="flex flex-col gap-5" aria-label="커뮤니티 게시글">
      <div className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="flex min-h-16 flex-wrap items-center gap-3 border-b border-[var(--ui-border)] px-4">
          <div className="flex min-w-0 flex-1 self-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="게시판 말머리">
            <CategoryButton active={activeCategory === null} onClick={() => { setActiveCategory(null); setPage(1); }}>
              전체
            </CategoryButton>
            {categories.map((category) => (
              <CategoryButton
                key={category.slug}
                active={activeCategory === category.slug}
                onClick={() => { setActiveCategory(category.slug); setPage(1); }}
              >
                {category.label}
              </CategoryButton>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={newPath}
              className="inline-flex h-10 items-center gap-2 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-4 text-sm font-bold text-[var(--ui-surface)] transition-opacity hover:opacity-85 active:translate-y-px"
            >
              <SquarePen size={16} strokeWidth={2} />
              <span className="hidden sm:inline">글쓰기</span>
            </Link>
          </div>
        </div>

        <PostList posts={paged} scope={scope} teamSlug={teamSlug} />
      </div>

      <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <form
          className="flex h-10 w-full max-w-[360px] overflow-hidden rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] focus-within:border-[var(--ui-ink)] lg:justify-self-start"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmittedQuery(query);
            setPage(1);
          }}
        >
          <label htmlFor="community-search" className="sr-only">게시글 검색</label>
          <input
            id="community-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 내용, 작성자 검색"
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
          />
          <button type="submit" className="grid w-11 place-items-center border-l border-[var(--ui-border)] text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]" aria-label="검색">
            <Search size={17} strokeWidth={2} />
          </button>
        </form>

        <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
        {submittedQuery ? (
          <button type="button" onClick={() => { setQuery(""); setSubmittedQuery(""); setPage(1); }} className="text-left text-[13px] font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)] lg:justify-self-end">
            검색 초기화
          </button>
        ) : <span />}
      </div>
    </section>
  );
}

function CategoryButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`relative shrink-0 px-2 text-base font-bold transition-colors ${active ? "text-[var(--ui-ink)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--ui-ink)]" : "text-[var(--ui-muted)] hover:text-[var(--ui-text)]"}`}>
      {children}
    </button>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="페이지 이동">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className="h-9 px-2 text-sm font-semibold text-[var(--ui-muted)] disabled:opacity-30">이전</button>
      {pages.map((number) => (
        <button key={number} type="button" onClick={() => onChange(number)} aria-current={number === page ? "page" : undefined} className={`grid h-9 min-w-9 place-items-center rounded-[var(--ui-control-radius)] px-2 text-sm font-bold ${number === page ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"}`}>
          {number}
        </button>
      ))}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} className="h-9 px-2 text-sm font-semibold text-[var(--ui-muted)] disabled:opacity-30">다음</button>
    </nav>
  );
}
