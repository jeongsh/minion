"use client";

import { ControlledDialog, dialogBodyClassName, DialogSheetHeader } from "@/components/responsive/adaptive-dialog";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { filterSpells, spellImageUrl, spellLabel, type GameSpell } from "@/lib/spells";

export function SpellPicker({
  spells,
  itemVersion,
  value,
  onValueChange,
  slotLabel,
  className = "",
}: {
  spells: GameSpell[];
  itemVersion: string;
  value: number | null;
  onValueChange: (spellId: number | null) => void;
  slotLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dialogId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => filterSpells(spells, query), [spells, query]);
  const selectedName = spellLabel(spells, value);
  const selectedSpell = spells.find((spell) => spell.id === value);
  const imageUrl = selectedSpell ? spellImageUrl(selectedSpell, itemVersion) : "";

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);


  function selectSpell(spellId: number | null) {
    onValueChange(spellId);
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
        aria-label={value ? `${slotLabel ?? "스펠"} ${selectedName}` : `${slotLabel ?? "스펠"} 선택`}
        onClick={() => setOpen(true)}
        className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-background transition hover:border-accent hover:ring-2 hover:ring-accent/30 ${className}`}
      >
        {value && imageUrl ? (
          <Image src={imageUrl} alt={selectedName} width={40} height={40} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[13px] font-semibold text-muted">
            {slotLabel ?? "+"}
          </span>
        )}
      </button>

      {open ? (
        <div id={dialogId}>
          <ControlledDialog open={open} onClose={() => { setOpen(false); setQuery(""); }} ariaLabel={"스펠 선택"} panelClassName="sm:max-w-md">
            <DialogSheetHeader onClose={() => { setOpen(false); setQuery(""); }} title={"스펠 선택"} />
            <div className={dialogBodyClassName}>
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="스펠 이름 검색"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground outline-none ring-accent focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => selectSpell(null)}
                    className="shrink-0 rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted hover:bg-background"
                  >
                    선택 해제
                  </button>
                </div>
              </div>
              <div>
                {filtered.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="grid gap-1">
                    {filtered.map((spell) => (
                      <li key={spell.id}>
                        <button
                          type="button"
                          onClick={() => selectSpell(spell.id)}
                          className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold transition hover:bg-background ${
                            value === spell.id ? "bg-background text-accent" : "text-foreground"
                          }`}
                        >
                          {spell.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </ControlledDialog>
        </div>
      ) : null}
    </>
  );
}
