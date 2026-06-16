"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { championImage, championLabel, filterChampions, pickerChampions } from "@/lib/champions";
import type { Champion } from "@/lib/types";

type ChampionPickerBaseProps = {
  name?: string;
  champions: Champion[];
  defaultValue?: string | null;
  value?: string;
  onValueChange?: (championId: string) => void;
  className?: string;
  disableHiddenInput?: boolean;
};

type ChampionPickerSelectProps = ChampionPickerBaseProps & {
  variant?: "select";
  placeholder?: string;
};

type ChampionPickerTileProps = ChampionPickerBaseProps & {
  variant: "tile";
  label?: string;
  subLabel?: string;
  muted?: boolean;
  align?: "left" | "right";
  emptyLabel?: string;
};

export type ChampionPickerProps = ChampionPickerSelectProps | ChampionPickerTileProps;

function ChampionPickerModal({
  champions,
  query,
  onQueryChange,
  onSelect,
  onClose,
}: {
  champions: Champion[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (championId: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const sorted = [...filterChampions(champions, query)].sort((a, b) =>
      championLabel(a).localeCompare(championLabel(b), "ko"),
    );
    return sorted;
  }, [champions, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="챔피언 선택"
        className="relative z-10 flex max-h-[min(80vh,42rem)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-surface shadow-xl"
      >
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="챔피언 검색 (한글/영문)"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-accent focus:ring-2"
            />
            <button
              type="button"
              onClick={() => onSelect("")}
              className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-background"
            >
              선택 해제
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">검색 결과가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
              {filtered.map((champion) => {
                const image = championImage(champion);
                return (
                  <button
                    key={champion.id}
                    type="button"
                    onClick={() => onSelect(champion.id)}
                    className="group overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-accent hover:ring-2 hover:ring-accent/40"
                  >
                    <div className="relative aspect-square overflow-hidden bg-surface-muted">
                      {image ? (
                        <Image
                          src={image}
                          alt={championLabel(champion)}
                          fill
                          sizes="80px"
                          className="object-cover transition group-hover:scale-105"
                        />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 px-1 py-1.5 text-center text-[11px] font-semibold leading-tight">
                      {championLabel(champion)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ChampionPicker(props: ChampionPickerProps) {
  const {
    name,
    champions,
    defaultValue = "",
    value,
    onValueChange,
    className = "",
    disableHiddenInput = false,
  } = props;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogId = useId();
  const currentValue = value ?? internalValue;
  const pickerChampionList = useMemo(() => pickerChampions(champions), [champions]);
  const selected =
    pickerChampionList.find((champion) => champion.id === currentValue) ??
    champions.find((champion) => champion.id === currentValue);

  function selectChampion(championId: string) {
    if (value === undefined) {
      setInternalValue(championId);
    }
    onValueChange?.(championId);
    setOpen(false);
    setQuery("");
  }

  if (props.variant === "tile") {
    const { label, subLabel, muted = false, align = "left", emptyLabel = "미입력" } = props;
    const image = championImage(selected);
    const displayName = selected ? championLabel(selected) : emptyLabel;

    return (
      <>
        {disableHiddenInput || !name ? null : <input type="hidden" name={name} value={currentValue} />}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          onClick={() => setOpen(true)}
          className={`group relative h-24 w-full overflow-hidden rounded-md border border-border bg-background text-left transition hover:border-accent hover:ring-2 hover:ring-accent/30 ${className}`}
        >
          {image ? (
            <Image
              src={image}
              alt={displayName}
              fill
              sizes="(max-width: 1024px) 20vw, 8vw"
              className={`object-cover ${muted ? "grayscale" : ""}`}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-surface-muted text-xs font-semibold text-muted">
              클릭하여 선택
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          {muted ? <div className="absolute inset-x-2 top-1/2 h-px rotate-[-18deg] bg-white/80" /> : null}
          <div
            className={`relative z-10 flex h-full flex-col justify-end p-2 text-white ${
              align === "right" ? "items-end text-right" : ""
            }`}
          >
            <p className="text-xs font-semibold text-white/75">{label ?? ""}</p>
            <p className="line-clamp-1 text-sm font-semibold">{displayName}</p>
            {subLabel ? <p className="line-clamp-1 text-xs text-white/75">{subLabel}</p> : null}
          </div>
        </button>
        {open ? (
          <div id={dialogId}>
            <ChampionPickerModal
              champions={pickerChampionList}
              query={query}
              onQueryChange={setQuery}
              onSelect={selectChampion}
              onClose={() => {
                setOpen(false);
                setQuery("");
              }}
            />
          </div>
        ) : null}
      </>
    );
  }

  const placeholder = props.placeholder ?? "챔피언 선택";
  const image = championImage(selected);

  return (
    <>
      {disableHiddenInput || !name ? null : <input type="hidden" name={name} value={currentValue} />}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded border border-border bg-background px-2 py-1.5 text-left text-sm font-semibold text-foreground transition hover:border-accent ${className}`}
      >
        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-surface-muted">
          {image ? (
            <Image src={image} alt="" width={32} height={32} className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate">{selected ? championLabel(selected) : placeholder}</span>
      </button>
      {open ? (
        <div id={dialogId}>
          <ChampionPickerModal
            champions={pickerChampionList}
            query={query}
            onQueryChange={setQuery}
            onSelect={selectChampion}
            onClose={() => {
              setOpen(false);
              setQuery("");
            }}
          />
        </div>
      ) : null}
    </>
  );
}
