"use client";

import Link from "next/link";
import { ArrowLeftRight, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";

export type ChampionPickerOption = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  searchText: string;
  games: number;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[\s.'’_-]+/g, "");
}

export function ChampionPicker({
  champions,
  currentChampionId,
  preservedQuery = "",
  compact = false,
}: {
  champions: ChampionPickerOption[];
  currentChampionId: string;
  preservedQuery?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedOnceRef = useRef(false);

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return champions;
    return champions.filter((champion) => normalize(champion.searchText).includes(term));
  }, [champions, query]);

  useEffect(() => {
    if (open) {
      openedOnceRef.current = true;
      inputRef.current?.focus();
      return;
    }
    if (openedOnceRef.current) {
      triggerRef.current?.focus();
      openedOnceRef.current = false;
    }
  }, [open]);

  const suffix = preservedQuery ? `?${preservedQuery}` : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`h-10 ${compact ? "grid w-10 place-items-center px-0" : "px-3.5"} shrink-0 rounded-lg bg-[var(--ui-card-bg)] text-[14px] font-medium text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]`}
        aria-haspopup="dialog"
        aria-label={compact ? "챔피언 변경" : undefined}
        title={compact ? "챔피언 변경" : undefined}
      >
        {compact ? <ArrowLeftRight aria-hidden="true" className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /> : "챔피언 변경"}
      </button>

      {open ? (
        <ControlledDialog open={open} onClose={() => setOpen(false)} labelledBy="champion-picker-title" panelClassName="sm:max-h-[78vh] sm:max-w-3xl">
            <DialogSheetHeader closeLabel="챔피언 선택 닫기" onClose={() => setOpen(false)} title="챔피언 선택" titleId="champion-picker-title" />

            <div className={dialogBodyClassName}>
            <div className="pb-4">
              <label className="flex h-11 items-center gap-2.5 rounded-xl bg-[var(--ui-card-bg)] px-3.5 text-[var(--ui-muted)] focus-within:ring-2 focus-within:ring-[var(--accent)]">
                <Search size={18} />
                <span className="sr-only">챔피언 검색</span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-[var(--ui-ink)] outline-none placeholder:text-[var(--ui-muted)]"
                  placeholder="챔피언 검색"
                />
                {query ? (
                  <button type="button" onClick={() => setQuery("")} className="grid h-8 w-8 place-items-center" aria-label="검색어 지우기">
                    <X size={17} />
                  </button>
                ) : null}
              </label>
            </div>

            <div>
              {filtered.length ? (
                <div className="grid grid-cols-5 gap-x-2 gap-y-4 sm:grid-cols-7 md:grid-cols-9">
                  {filtered.map((champion) => {
                    const active = champion.id === currentChampionId;
                    return (
                      <Link
                        key={champion.id}
                        href={`/champions/${champion.slug}${suffix}`}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className="group min-w-0 text-center"
                      >
                        <span className={`mx-auto block aspect-square w-full max-w-14 overflow-hidden rounded-xl transition ${active ? "ring-3 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--ui-surface)]" : "group-hover:-translate-y-0.5"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={champion.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                        </span>
                        <span className={`mt-1.5 block truncate text-[13px] ${active ? "font-medium text-[var(--ui-ink)]" : "font-medium text-[var(--ui-muted)] group-hover:text-[var(--ui-ink)]"}`}>{champion.name}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-48 place-items-center text-center">
                  <div>
                    <p className="text-sm font-medium text-[var(--ui-ink)]">검색 결과가 없습니다.</p>
                    <p className="mt-2 text-sm font-normal text-[var(--ui-muted)]">다른 이름으로 검색해 보세요.</p>
                  </div>
                </div>
              )}
            </div>
            </div>
        </ControlledDialog>
      ) : null}
    </>
  );
}
