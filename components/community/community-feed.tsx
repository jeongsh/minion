"use client";

import { Search, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { FilterDropdown } from "@/components/match-filter-dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedToggle } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PostList } from "@/components/community/post-list";
import { Pagination } from "@/components/ui/pagination";
import { AdSlot } from "@/components/ui/ad-slot";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import type { BoardPostPage } from "@/lib/data/community";



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
            <SegmentedToggle items={[{key:"all",label:"전체"},{key:"hot",label:"인기글"}]} activeKey={hotOnly ? "hot" : "all"} ariaLabel="게시글 보기" onSelect={(key) => navigateWith({view:key === "hot" ? "hot" : null,cat:null})} />
            <FilterDropdown ariaLabel="말머리 선택" placeholder="말머리" selected={categoryValue} options={categories.map(category=>({value:category.slug,label:category.label}))} onSelect={value=>navigateWith({cat:value,view:null})} rootClassName="min-w-28" triggerClassName="w-full" />

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

      <AdSlot enabled={!searchQuery && [...postPage.posts, ...postPage.notices].some((post) => !post.blindedAt && !post.deletedAt)} placement="horizontal" className="mt-6 h-[60px] xl:h-[90px]" />

      <Link href={newPath} className="fixed bottom-[calc(3.25rem+env(safe-area-inset-bottom)+18px)] right-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-[var(--ui-border)] bg-[var(--ui-ink)] text-[var(--ui-surface)] shadow-[0_12px_34px_rgba(15,23,42,0.22)] transition-opacity hover:opacity-90 md:bottom-6 lg:hidden" aria-label="글쓰기">
        <SquarePen size={20} strokeWidth={2} />
      </Link>
    </section>
  );
}

function SearchForm({ query, setQuery, onSubmit, className }: { query: string; setQuery: (value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; className: string }) {
  return (
    <form className={`items-center gap-2 ${className}`} onSubmit={onSubmit}>
      <SearchInput aria-label="게시글 검색" value={query} onChange={event=>setQuery(event.target.value)} placeholder="제목, 내용 검색" />
      <Button type="submit" variant="secondary" aria-label="검색"><Search size={16} /></Button>
    </form>
  );
}

function SearchStatus({ query, count, onClear }: { query: string; count: number; onClear: () => void }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-[13px] text-[var(--ui-muted)]">
      <span className="min-w-0 truncate">‘{query}’ 검색 결과 {count.toLocaleString("ko-KR")}개</span>
      <button type="button" onClick={onClear} className="shrink-0 font-medium text-[var(--ui-text)] underline underline-offset-2">초기화</button>
    </div>
  );
}
