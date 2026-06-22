"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

const SORT_OPTIONS = [
  { value: "date_desc", label: "최신순" },
  { value: "date_asc", label: "오래된순" },
  { value: "views_desc", label: "조회수 많은순" },
  { value: "views_asc", label: "조회수 적은순" },
  { value: "title_asc", label: "제목 가나다순" },
];

function buildUrl(base: { q: string; type: string; sort: string }, overrides: { q?: string; sort?: string; page?: string }) {
  const p = new URLSearchParams();
  const q = overrides.q ?? base.q;
  const sort = overrides.sort ?? base.sort;
  const page = overrides.page ?? "1";
  if (q) p.set("q", q);
  p.set("type", base.type);
  p.set("sort", sort);
  if (page !== "1") p.set("page", page);
  return `/admin/news?${p.toString()}`;
}

export function NewsSearchBar({
  defaultQuery,
  currentType,
  currentSort,
}: {
  defaultQuery: string;
  currentType: string;
  currentSort: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const base = { q: defaultQuery, type: currentType, sort: currentSort };

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = inputRef.current?.value.trim() ?? "";
    router.push(buildUrl(base, { q, page: "1" }));
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(buildUrl(base, { sort: e.target.value, page: "1" }));
  }

  return (
    <>
      <form onSubmit={handleSearch} className="flex h-9 items-center overflow-hidden rounded-md border border-border bg-surface">
        <input
          ref={inputRef}
          type="text"
          defaultValue={defaultQuery}
          placeholder="제목 검색…"
          className="h-full w-48 min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          className="flex h-full items-center px-3 text-muted transition-colors hover:text-foreground"
          aria-label="검색"
        >
          ⌕
        </button>
      </form>

      <select
        className="h-9 rounded-md border border-border bg-surface pl-3 pr-7 text-sm text-foreground focus:outline-none"
        defaultValue={currentSort}
        onChange={handleSortChange}
        aria-label="정렬"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </>
  );
}
