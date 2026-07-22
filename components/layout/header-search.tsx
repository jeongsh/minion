"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, Swords, UserRound, X } from "lucide-react";

import type { SearchResult } from "@/app/api/search/route";

const MIN_SEARCH_LENGTH = 2;

const TYPE_ICON = {
  team: null,
  player: UserRound,
  tournament: Swords,
} as const;

export function HeaderSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_SEARCH_LENGTH) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
        setActiveIndex(data.results.length > 0 ? 0 : -1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const go = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    inputRef.current?.blur();
    router.push(result.href);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (results.length === 0 ? -1 : (index + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? -1 : (index - 1 + results.length) % results.length));
    } else if (event.key === "Enter") {
      const target = results[activeIndex] ?? results[0];
      if (target) {
        event.preventDefault();
        go(target);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const showPanel = open && query.trim().length >= MIN_SEARCH_LENGTH;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="flex h-10 items-center gap-2 rounded-xl bg-[#f2f3f5] px-4 text-[#777b82] focus-within:ring-2 focus-within:ring-[#141517]/15 dark:bg-[#282c31] dark:focus-within:ring-white/20">
        {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < MIN_SEARCH_LENGTH) {
              setResults([]);
              setLoading(false);
              setActiveIndex(-1);
            } else {
              setLoading(true);
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ui-ink)] outline-none placeholder:text-[#777b82]"
          placeholder="팀, 선수, 대회 검색"
        />
        {query.length > 0 ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("");
              setResults([]);
              setLoading(false);
              setActiveIndex(-1);
              inputRef.current?.focus();
            }}
            aria-label="검색어 지우기"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[#777b82] hover:bg-[#e4e6ea] dark:hover:bg-[#343840]"
          >
            <X size={15} />
          </button>
        ) : null}
      </label>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#e8e8eb] bg-background shadow-xl shadow-black/10 dark:border-[#343840]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm font-semibold text-[var(--ui-muted)]">
              {loading ? "검색 중…" : `'${query.trim()}' 검색 결과가 없어요`}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto py-1.5">
              {results.map((result, index) => {
                const Icon = TYPE_ICON[result.type];
                const active = index === activeIndex;
                return (
                  <li key={`${result.type}-${result.href}`} id={`${listboxId}-${index}`} role="option" aria-selected={active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => go(result)}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${active ? "bg-[#f4f4f5] dark:bg-[#282c31]" : ""}`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f2f3f5] dark:bg-[#30343b]">
                        {result.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={result.imageUrl} alt="" loading="lazy" decoding="async" className="h-8 w-8 object-contain" />
                        ) : Icon ? (
                          <Icon size={18} className="text-[var(--ui-muted)]" />
                        ) : (
                          <span className="text-[13px] font-black text-[var(--ui-muted)]">{result.title.slice(0, 2)}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-black text-[var(--ui-ink)]">{result.title}</span>
                        <span className="block truncate text-[12px] font-semibold text-[var(--ui-muted)]">{result.subtitle}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
