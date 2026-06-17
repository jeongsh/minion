"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { filterItems, itemImageUrl, itemLabel, type GameItem } from "@/lib/items";

export function ItemPicker({
  items,
  itemVersion,
  value,
  onValueChange,
  slotLabel,
  className = "",
}: {
  items: GameItem[];
  itemVersion: string;
  value: number | null;
  onValueChange: (itemId: number | null) => void;
  slotLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterItems(items, query), [items, query]);
  const selectedName = itemLabel(items, value);
  const imageUrl = value ? itemImageUrl(value, itemVersion) : "";

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

  function selectItem(itemId: number | null) {
    onValueChange(itemId);
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
        aria-label={value ? `${slotLabel ?? "아이템"} ${selectedName}` : `${slotLabel ?? "아이템"} 선택`}
        onClick={() => setOpen(true)}
        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-background transition hover:border-accent hover:ring-2 hover:ring-accent/30 ${className}`}
      >
        {value && imageUrl ? (
          <Image src={imageUrl} alt={selectedName} width={40} height={40} className="h-full w-full object-cover" />
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
              aria-label="아이템 선택"
              className="relative z-10 flex max-h-[min(80vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-md border border-border bg-surface shadow-xl"
            >
              <div className="border-b border-border p-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="아이템 이름 검색"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-accent focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => selectItem(null)}
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
                    {filtered.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => selectItem(item.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition hover:bg-background ${
                            value === item.id ? "bg-background text-accent" : "text-foreground"
                          }`}
                        >
                          {item.name}
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
