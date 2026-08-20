"use client";

import { ChevronDown, Search, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PostList } from "@/components/community/post-list";
import { Pagination } from "@/components/ui/pagination";
import { categoriesForScope, type BoardDef, type BoardScope } from "@/lib/community/boards";
import type { BoardPostPage } from "@/lib/data/community";

const HOT_FILTER = "__hot__";

export function CommunityFeed({
  postPage,
  scope,
  teamSlug,
  newPath,
  viewerId,
  activeCategory,
  searchQuery,
  hotOnly,
}: {
  postPage: BoardPostPage;
  scope: BoardScope;
  teamSlug?: string;
  newPath: string;
  viewerId?: string | null;
  activeCategory?: string | null;
  searchQuery?: string | null;
  hotOnly: boolean;
}) {
  const categories = categoriesForScope(scope);
  const pathname = usePathname();
  const router = useRouter();
  const currentParams = useSearchParams();
  const [query, setQuery] = useState(searchQuery ?? "");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(currentParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const suffix = params.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  };

  const navigateWith = (changes: Record<string, string | null>) => {
    router.push(hrefWith({ ...changes, page: null }));
  };

  const selectedView = hotOnly ? HOT_FILTER : activeCategory ?? null;
  const categoryValue = activeCategory ?? "";

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigateWith({ q: query.trim() || null });
  };

  const clearSearch = () => {
    setQuery("");
    navigateWith({ q: null });
  };

  return (
    <section aria-label="커뮤니티 게시글">
      <div className="mobile-full-bleed mobile-list-shell overflow-visible rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] sm:mx-0">
        <div className="border-b border-[var(--ui-border)] px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-wrap items-start gap-2">
            <div className="inline-flex h-9 shrink-0 items-center rounded-[var(--ui-control-radius)] bg-[var(--ui-surface-muted)] p-1" role="tablist" aria-label="게시글 보기">
              <ViewButton active={selectedView === null} onClick={() => navigateWith({ view: null, cat: null })}>전체</ViewButton>
              <ViewButton active={selectedView === HOT_FILTER} onClick={() => navigateWith({ view: "hot", cat: null })}>인기글</ViewButton>
            </div>

            <CategorySelect categories={categories} value={categoryValue} onChange={(value) => navigateWith({ cat: value, view: null })} />

            <button type="button" onClick={() => setMobileSearchOpen((open) => !open)} className="ml-auto grid h-9 w-9 place-items-center rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] text-[var(--ui-muted)] md:hidden" aria-label={mobileSearchOpen ? "검색 닫기" : "게시글 검색"} aria-expanded={mobileSearchOpen}>
              {mobileSearchOpen ? <X size={17} /> : <Search size={17} />}
            </button>

            <div className="ml-auto hidden w-[240px] md:block xl:w-[280px]">
              <SearchForm query={query} setQuery={setQuery} onSubmit={submitSearch} className="flex w-full" />
              {searchQuery ? <SearchStatus query={searchQuery} count={postPage.totalCount} onClear={clearSearch} /> : null}
            </div>

            <Link href={newPath} className="hidden h-9 shrink-0 items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-3.5 text-[13px] font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-85 lg:inline-flex" aria-label="글쓰기">
              <SquarePen size={15} strokeWidth={2} />글쓰기
            </Link>
          </div>

          {mobileSearchOpen ? (
            <div className="md:hidden">
              <SearchForm query={query} setQuery={setQuery} onSubmit={submitSearch} className="mt-2 flex w-full" />
              {searchQuery ? <SearchStatus query={searchQuery} count={postPage.totalCount} onClear={clearSearch} /> : null}
            </div>
          ) : null}
        </div>

        <PostList posts={postPage.posts} pinned={postPage.notices} scope={scope} teamSlug={teamSlug} viewerId={viewerId} />

        <div className="border-t border-[var(--ui-border)] px-3 py-2 sm:px-4">
          <Pagination page={postPage.page} totalPages={postPage.totalPages} getHref={(page) => hrefWith({ page: page > 1 ? String(page) : null })} />
        </div>
      </div>

      <Link href={newPath} className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom)+18px)] right-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-[0_12px_34px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-90 md:bottom-6 lg:hidden" aria-label="글쓰기">
        <SquarePen size={20} strokeWidth={2} />
      </Link>
    </section>
  );
}

function ViewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`inline-flex h-7 shrink-0 items-center justify-center rounded-[calc(var(--ui-control-radius)-4px)] px-3 text-[13px] font-semibold transition ${
        active
          ? "bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-sm"
          : "text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

function CategorySelect({ categories, value, onChange }: { categories: BoardDef[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = categories.find((category) => category.slug === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative h-9 min-w-[112px] shrink-0">
      <button type="button" onClick={() => setOpen((current) => !current)} className="flex h-full w-full items-center justify-between gap-3 rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] pl-3 pr-2.5 text-[13px] font-medium text-[var(--ui-text)] outline-none focus-visible:border-[var(--ui-ink)] sm:text-sm" aria-label="말머리 선택" aria-haspopup="listbox" aria-expanded={open}>
        <span>{selected?.label ?? "말머리"}</span>
        <ChevronDown size={14} className={`shrink-0 text-[var(--ui-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div role="listbox" aria-label="말머리" className="absolute left-0 top-[calc(100%+6px)] z-30 w-36 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-xl shadow-black/15">
          {categories.map((category) => {
            const active = category.slug === value;
            return (
              <button key={category.slug} type="button" role="option" aria-selected={active} onClick={() => { onChange(category.slug); setOpen(false); }} className={`flex h-9 w-full items-center rounded-lg px-3 text-left text-[13px] font-medium ${active ? "bg-[var(--ui-surface-muted)] text-[var(--ui-ink)]" : "text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]"}`}>
                {category.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SearchForm({ query, setQuery, onSubmit, className }: { query: string; setQuery: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; className: string }) {
  const inputId = `community-search-${className.includes("mt-2") ? "mobile" : "desktop"}`;

  return (
    <form className={`h-9 overflow-hidden rounded-[var(--ui-control-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)] focus-within:border-[var(--ui-ink)] ${className}`} onSubmit={onSubmit}>
      <label htmlFor={inputId} className="sr-only">게시글 검색</label>
      <input id={inputId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 내용 검색" className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]" />
      <button type="submit" className="grid w-9 shrink-0 place-items-center text-[var(--ui-muted)] hover:text-[var(--ui-ink)]" aria-label="검색"><Search size={16} strokeWidth={2} /></button>
    </form>
  );
}

function SearchStatus({ query, count, onClear }: { query: string; count: number; onClear: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--ui-muted)]">
      <span className="min-w-0 truncate">‘{query}’ 검색 결과 {count.toLocaleString("ko-KR")}개</span>
      <button type="button" onClick={onClear} className="shrink-0 font-semibold text-[var(--ui-text)] underline underline-offset-2">초기화</button>
    </div>
  );
}
