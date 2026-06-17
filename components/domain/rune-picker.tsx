"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { filterRunes, runeImageUrl, runeLabel, type GameRuneOption } from "@/lib/runes";

export function RunePicker({
  runes,
  value,
  onValueChange,
  slotLabel,
  searchPlaceholder = "특성 이름 검색",
  dialogLabel = "특성 선택",
  size = "md",
  className = "",
}: {
  runes: GameRuneOption[];
  value: number | null;
  onValueChange: (runeId: number | null) => void;
  slotLabel?: string;
  searchPlaceholder?: string;
  dialogLabel?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterRunes(runes, query), [runes, query]);
  const selectedName = runeLabel(runes, value);
  const selectedRune = runes.find((rune) => rune.id === value);
  const imageUrl = selectedRune ? runeImageUrl(selectedRune) : "";
  const sizeClass =
    size === "lg" ? "h-11 w-11" : size === "sm" ? "h-7 w-7 rounded-sm" : "h-10 w-10";
  const imageSize = size === "lg" ? 44 : size === "sm" ? 28 : 40;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectRune(runeId: number | null) {
    onValueChange(runeId);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={value ? `${slotLabel ?? "특성"} ${selectedName}` : `${slotLabel ?? "특성"} 선택`}
        onClick={() => setOpen(true)}
        className={`relative shrink-0 overflow-hidden rounded-md border border-border bg-background transition hover:border-accent hover:ring-2 hover:ring-accent/30 ${sizeClass} ${className}`}
      >
        {value && imageUrl ? (
          <Image
            src={imageUrl}
            alt={selectedName}
            width={imageSize}
            height={imageSize}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-[10px] font-semibold text-muted">
            {slotLabel ?? "+"}
          </span>
        )}
      </button>

      {open ? (
        <div id={dialogId}>
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="presentation">
            <button
              type="button"
              aria-label="닫기"
              className="absolute inset-0 bg-black/60"
              onClick={() => {
                setOpen(false);
                setQuery("");
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={dialogLabel}
              className="relative z-10 flex max-h-[min(80vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-md border border-border bg-surface shadow-xl"
            >
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-accent focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => selectRune(null)}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-background"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto p-2">
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="grid gap-1">
                    {filtered.map((rune) => (
                      <li key={rune.id}>
                        <button
                          type="button"
                          onClick={() => selectRune(rune.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition hover:bg-background ${
                            value === rune.id ? "bg-background text-accent" : "text-foreground"
                          }`}
                        >
                          <span>{rune.name}</span>
                          {rune.treeName ? (
                            <span className="ml-2 text-xs font-semibold text-muted">{rune.treeName}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
