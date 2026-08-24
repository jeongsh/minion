"use client";

import Image from "next/image";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { ChampionAbilityIcons } from "@/lib/champions";
import { itemImageUrl } from "@/lib/items";
import type { ItemPurchaseGroup, SkillLevelUp } from "@/lib/player-build";
import type { RuneBuildGrid, RuneGridOption, RuneGridRow } from "@/lib/runes";

export type PlayerBuildPanelEntry = {
  playerId: string;
  playerName: string;
  championImageUrl: string;
  abilityIcons: ChampionAbilityIcons | null;
  side: "blue" | "red";
  won: boolean;
  version: string;
  keystoneUrl: string;
  treeUrl: string;
  runeGrid: RuneBuildGrid | null;
  skillOrder: SkillLevelUp[];
  itemPurchaseGroups: ItemPurchaseGroup[];
};

const SECTION_LABEL_CLASS = "text-xs font-bold uppercase tracking-wide text-accent";

const KEYSTONE_ICON_SIZE = 34;
const MINOR_ICON_SIZE = 26;
const MAX_LEVEL = 18;
const SKILL_CELL_SIZE = 26;

const SKILL_SLOT_LABEL: Record<SkillLevelUp["slot"], string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };
const SKILL_SLOTS: SkillLevelUp["slot"][] = [1, 2, 3, 4];
const SKILL_SLOT_STYLE: Record<SkillLevelUp["slot"], { text: string; bg: string; border: string }> = {
  1: { text: "text-sky-400", bg: "bg-sky-500/20", border: "border-sky-500/60" },
  2: { text: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/60" },
  3: { text: "text-fuchsia-400", bg: "bg-fuchsia-500/20", border: "border-fuchsia-500/60" },
  4: { text: "text-accent", bg: "bg-accent/20", border: "border-accent" },
};

function RuneGridIcon({ option, size, square = false }: { option: RuneGridOption; size: number; square?: boolean }) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden bg-[#0d1117] ${square ? "rounded-md" : "rounded-full"} ${
        option.selected ? "ring-2 ring-accent" : "opacity-40 grayscale"
      }`}
      style={{ height: size, width: size }}
      title={option.name}
    >
      {option.url ? (
        <Image src={option.url} alt={option.name} fill sizes={`${size}px`} unoptimized className="object-contain" />
      ) : null}
    </span>
  );
}

function RuneGridRowLine({ row, square }: { row: RuneGridRow; square?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      {row.map((option) => (
        <RuneGridIcon key={option.name} option={option} size={MINOR_ICON_SIZE} square={square} />
      ))}
    </div>
  );
}

function RuneColumn({
  label,
  treeIcon,
  keystone,
  rows,
  square = false,
}: {
  label: string;
  treeIcon: string;
  keystone?: RuneGridOption;
  rows: RuneGridRow[];
  square?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="relative h-5 w-5 shrink-0 overflow-hidden opacity-80" title={label}>
        {treeIcon ? <Image src={treeIcon} alt={label} fill sizes="20px" unoptimized className="object-contain" /> : null}
      </span>
      <div className="flex items-center justify-center" style={{ height: KEYSTONE_ICON_SIZE }}>
        {keystone ? <RuneGridIcon option={keystone} size={KEYSTONE_ICON_SIZE} /> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <RuneGridRowLine key={index} row={row} square={square} />
        ))}
      </div>
      <span className="text-[11px] font-medium text-muted">{label}</span>
    </div>
  );
}

function RunesBlock({ entry }: { entry: PlayerBuildPanelEntry }) {
  return (
    <div className="flex h-full flex-col">
      <h3 className={`mb-2 ${SECTION_LABEL_CLASS}`}>Runes</h3>
      {entry.runeGrid ? (
        <div className="flex flex-1 items-start justify-center gap-5 rounded-lg bg-[var(--ui-card-bg)] p-4">
          <RuneColumn
            label={entry.runeGrid.primaryTreeName}
            treeIcon={entry.runeGrid.primaryTreeIcon}
            keystone={entry.runeGrid.primaryRows[0]?.find((option) => option.selected)}
            rows={entry.runeGrid.primaryRows.slice(1)}
          />
          <span className="my-1 w-px self-stretch bg-[var(--ui-border)]" aria-hidden="true" />
          <RuneColumn
            label={entry.runeGrid.secondaryTreeName}
            treeIcon={entry.runeGrid.secondaryTreeIcon}
            rows={entry.runeGrid.secondaryRows}
          />
          <span className="my-1 w-px self-stretch bg-[var(--ui-border)]" aria-hidden="true" />
          <RuneColumn label="능력치 파편" treeIcon="" rows={entry.runeGrid.shardRows} square />
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 rounded-lg bg-[var(--ui-card-bg)] p-4">
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#0d1117]">
            {entry.keystoneUrl ? (
              <Image src={entry.keystoneUrl} alt="" fill sizes="36px" unoptimized className="object-contain" />
            ) : null}
          </span>
          <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#0d1117]">
            {entry.treeUrl ? (
              <Image src={entry.treeUrl} alt="" fill sizes="28px" unoptimized className="scale-[0.72] object-contain" />
            ) : null}
          </span>
        </div>
      )}
    </div>
  );
}

function clockLabel(timestampMs: number) {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ItemBuildBlock({ entry }: { entry: PlayerBuildPanelEntry }) {
  if (entry.itemPurchaseGroups.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <h3 className={`mb-2 ${SECTION_LABEL_CLASS}`}>Item Build</h3>
        <p className="flex-1 rounded-lg bg-[var(--ui-card-bg)] p-3 text-sm text-muted">타임라인 데이터가 아직 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className={`mb-2 ${SECTION_LABEL_CLASS}`}>Item Build</h3>
      <div className="flex flex-1 flex-wrap content-start items-start gap-x-4 gap-y-2 rounded-lg bg-[var(--ui-card-bg)] p-4">
        {entry.itemPurchaseGroups.map((group, groupIndex) => {
          const isStarting = groupIndex === 0 && group.purchases[0].timestampMs < 90_000;
          return (
            <div
              key={`${group.purchases[0].itemId}-${group.purchases[0].timestampMs}`}
              className="flex shrink-0 flex-col items-start gap-0.5"
            >
              <div className="flex items-center gap-1">
                {!isStarting ? (
                  <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" />
                ) : null}
                {group.purchases.map((purchase) => (
                  <span
                    key={`${purchase.itemId}-${purchase.timestampMs}`}
                    className={`relative h-9 w-9 shrink-0 overflow-hidden rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] ${
                      purchase.sold ? "opacity-40" : ""
                    }`}
                  >
                    <Image src={itemImageUrl(purchase.itemId, entry.version)} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                ))}
              </div>
              {!isStarting ? (
                <span className="pl-[18px] text-[11px] font-medium text-muted">{clockLabel(group.purchases[0].timestampMs)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillBuildBlock({ entry }: { entry: PlayerBuildPanelEntry }) {
  if (entry.skillOrder.length === 0) return null;

  return (
    <div>
      <h3 className={`mb-2 ${SECTION_LABEL_CLASS}`}>Skill Build</h3>
      <div className="flex flex-col gap-1 rounded-lg bg-[var(--ui-card-bg)] p-3">
        {SKILL_SLOTS.map((slot) => {
          const style = SKILL_SLOT_STYLE[slot];
          const pickedLevels = new Set(entry.skillOrder.filter((skill) => skill.slot === slot).map((skill) => skill.level));

          const iconUrl = entry.abilityIcons?.[slot] ?? "";

          return (
            <div key={slot} className="flex items-center gap-1.5">
              <span
                className={`grid shrink-0 place-items-center rounded text-[10px] font-bold ${style.bg} ${style.text}`}
                style={{ height: SKILL_CELL_SIZE, width: SKILL_CELL_SIZE }}
              >
                {SKILL_SLOT_LABEL[slot]}
              </span>
              {iconUrl ? (
                <span
                  className="relative shrink-0 overflow-hidden rounded border border-[var(--ui-border)]"
                  style={{ height: SKILL_CELL_SIZE, width: SKILL_CELL_SIZE }}
                >
                  <Image src={iconUrl} alt="" fill sizes={`${SKILL_CELL_SIZE}px`} className="object-cover" />
                </span>
              ) : null}
              <div className="flex gap-1">
                {Array.from({ length: MAX_LEVEL }, (_, index) => {
                  const level = index + 1;
                  const picked = pickedLevels.has(level);
                  return (
                    <span
                      key={level}
                      className={`grid place-items-center rounded text-[9px] font-bold ${
                        picked ? `border ${style.bg} ${style.text} ${style.border}` : "bg-[var(--ui-surface)]"
                      }`}
                      style={{ height: SKILL_CELL_SIZE, width: SKILL_CELL_SIZE }}
                    >
                      {picked ? level : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerTab({
  entry,
  selected,
  onSelect,
}: {
  entry: PlayerBuildPanelEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-lg border-2 px-2 py-1.5 transition-colors ${
        selected ? "border-accent" : "border-transparent hover:bg-[var(--ui-surface-muted)]"
      }`}
    >
      <span className="relative h-12 w-12 overflow-hidden rounded-md border border-[var(--ui-border)] bg-[var(--ui-card-bg)]">
        {entry.championImageUrl ? (
          <Image src={entry.championImageUrl} alt="" fill sizes="48px" className="object-cover" />
        ) : null}
        {entry.won ? (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-accent text-accent-foreground">
            <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="max-w-20 truncate text-[13px] font-medium text-[var(--ui-ink)]">{entry.playerName}</span>
    </button>
  );
}

export function PlayerBuildPanel({ entries }: { entries: PlayerBuildPanelEntry[] }) {
  const [selectedId, setSelectedId] = useState(entries[0]?.playerId ?? null);
  const selected = entries.find((entry) => entry.playerId === selectedId) ?? entries[0];
  const blueEntries = entries.filter((entry) => entry.side === "blue");
  const redEntries = entries.filter((entry) => entry.side === "red");

  if (!selected) return null;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="player-build">
      <h2 id="player-build" className={SECTION_LABEL_CLASS}>
        Build
      </h2>

      <div className="tab-scroll flex items-center gap-3 overflow-x-auto rounded-lg bg-surface p-2">
        <div className="flex shrink-0 items-center gap-1">
          {blueEntries.map((entry) => (
            <PlayerTab key={entry.playerId} entry={entry} selected={entry.playerId === selected.playerId} onSelect={() => setSelectedId(entry.playerId)} />
          ))}
        </div>
        <span className="h-14 w-px shrink-0 bg-[var(--ui-border)]" aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-1">
          {redEntries.map((entry) => (
            <PlayerTab key={entry.playerId} entry={entry} selected={entry.playerId === selected.playerId} onSelect={() => setSelectedId(entry.playerId)} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <RunesBlock entry={selected} />
        <ItemBuildBlock entry={selected} />
      </div>

      <SkillBuildBlock entry={selected} />
    </section>
  );
}
