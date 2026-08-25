"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { ChampionAbilityIcons } from "@/lib/champions";
import type { ItemPurchaseGroup, SkillLevelUp } from "@/lib/player-build";
import type { RuneBuildGrid, RuneGridOption } from "@/lib/runes";

export type PlayerBuildPanelEntry = {
  playerId: string;
  playerName: string;
  championName: string;
  championImageUrl: string;
  abilityIcons: ChampionAbilityIcons | null;
  position: string | null;
  teamName: string;
  side: "blue" | "red";
  version: string;
  keystoneUrl: string | null;
  treeUrl: string | null;
  runeGrid: RuneBuildGrid | null;
  skillOrder: SkillLevelUp[];
  itemPurchaseGroups: ItemPurchaseGroup[];
};

const SKILLS = [1, 2, 3, 4] as const;
const SKILL_KEY: Record<(typeof SKILLS)[number], string> = { 1: "Q", 2: "W", 3: "E", 4: "R" };

function PlayerTabs({
  entries,
  selectedId,
  onSelect,
}: {
  entries: PlayerBuildPanelEntry[];
  selectedId: string;
  onSelect: (playerId: string) => void;
}) {
  const bluePlayers = entries.filter((entry) => entry.side === "blue");
  const redPlayers = entries.filter((entry) => entry.side === "red");

  const renderPlayers = (players: PlayerBuildPanelEntry[]) =>
    players.map((entry) => {
      const selected = entry.playerId === selectedId;
      const selectedSurface =
        entry.side === "blue"
          ? "bg-team-blue/10"
          : "bg-team-red/10";
      const selectedText = entry.side === "blue" ? "text-team-blue" : "text-team-red";
      const focusSurface = entry.side === "blue" ? "focus-visible:bg-team-blue/10" : "focus-visible:bg-team-red/10";

      return (
        <button
          key={entry.playerId}
          type="button"
          aria-label={`${entry.playerName} 빌드 보기`}
          aria-pressed={selected}
          onClick={() => onSelect(entry.playerId)}
          className={`group flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-lg outline-none transition-colors focus-visible:outline-none ${focusSurface} ${
            selected ? selectedSurface : "hover:bg-[var(--ui-card-hover)]"
          }`}
        >
          <span className="relative h-10 w-10 overflow-hidden rounded-md bg-[var(--ui-card-bg)]">
            {entry.championImageUrl ? (
              <Image
                src={entry.championImageUrl}
                alt={entry.championName}
                fill
                sizes="40px"
                className={`object-cover transition-opacity ${selected ? "opacity-100" : "opacity-75 group-hover:opacity-100"}`}
              />
            ) : null}
          </span>
          <span
            className={`mt-1 block w-full truncate px-1 text-center text-[13px] font-medium leading-4 ${
              selected ? selectedText : "text-[var(--ui-text)]"
            }`}
          >
            {entry.playerName}
          </span>
        </button>
      );
    });

  return (
    <div className="overflow-x-auto px-4 pb-3 pt-4">
      <div className="mx-auto flex min-w-[700px] items-start justify-between gap-8">
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-medium text-[var(--ui-muted)]">
            {bluePlayers[0]?.teamName ?? "블루 팀"}
          </p>
          <div className="flex gap-1">{renderPlayers(bluePlayers)}</div>
        </div>

        <div>
          <p className="mb-1.5 px-1 text-right text-[13px] font-medium text-[var(--ui-muted)]">
            {redPlayers[0]?.teamName ?? "레드 팀"}
          </p>
          <div className="flex justify-end gap-1">{renderPlayers(redPlayers)}</div>
        </div>
      </div>
    </div>
  );
}

function RuneIcon({
  rune,
  keystone = false,
  shard = false,
}: {
  rune: RuneGridOption;
  keystone?: boolean;
  shard?: boolean;
}) {
  const size = keystone ? "h-12 w-12" : shard ? "h-8 w-8" : "h-9 w-9";
  const iconPadding = keystone || shard ? "p-1" : "p-0.5";
  const slotBackground = shard
    ? "bg-[#cdd0d6] dark:bg-[#24272d]"
    : "bg-[#d9dce2] dark:bg-[#24272d]";

  return (
    <span
      title={rune.name}
      className={`relative block shrink-0 rounded-full ${slotBackground} ${size}`}
    >
      {rune.url ? (
        <Image
          src={rune.url}
          alt={rune.name}
          fill
          sizes={keystone ? "48px" : shard ? "32px" : "36px"}
          className={`object-contain ${iconPadding} ${rune.selected ? "opacity-100" : "opacity-[0.32] grayscale"}`}
          unoptimized
        />
      ) : null}
    </span>
  );
}

function RuneRow({
  row,
  keystone = false,
  shard = false,
}: {
  row: RuneGridOption[];
  keystone?: boolean;
  shard?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-2.5 ${
        keystone ? "min-h-[60px]" : shard ? "min-h-[42px]" : "min-h-[54px]"
      }`}
    >
      {row.map((rune) => (
        <RuneIcon key={rune.name} rune={rune} keystone={keystone} shard={shard} />
      ))}
    </div>
  );
}

function RuneColumn({
  icon,
  name,
  rows,
  primary = false,
}: {
  icon?: string;
  name: string;
  rows: RuneGridOption[][];
  primary?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex h-9 items-center justify-center gap-2">
        {icon ? (
          <span className="relative h-6 w-6 shrink-0">
            <Image src={icon} alt="" fill sizes="24px" className="object-contain" unoptimized />
          </span>
        ) : null}
        <span className="text-sm font-medium text-[var(--ui-text)]">{name}</span>
      </div>

      <div className="mt-1">
        {rows.map((row, index) => (
          <RuneRow key={`${name}-${index}`} row={row} keystone={primary && index === 0} />
        ))}
      </div>
    </div>
  );
}

function ShardColumn({ rows }: { rows: RuneGridOption[][] }) {
  return (
    <div className="mt-3 min-w-0" aria-label="능력치 파편">
      {rows.map((row, index) => (
        <RuneRow key={`능력치 파편-${index}`} row={row} shard />
      ))}
    </div>
  );
}

function Runes({ entry }: { entry: PlayerBuildPanelEntry }) {
  const grid = entry.runeGrid;

  if (!grid) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-5">
        {[entry.keystoneUrl, entry.treeUrl].filter(Boolean).map((url) => (
          <span key={url} className="relative h-10 w-10">
            <Image src={url as string} alt="" fill sizes="40px" className="object-contain" unoptimized />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-2 grid w-full max-w-[480px] flex-1 grid-cols-2 items-start gap-3 py-1">
      <RuneColumn
        icon={grid.primaryTreeIcon}
        name={grid.primaryTreeName}
        rows={grid.primaryRows}
        primary
      />
      <div className="min-w-0">
        <RuneColumn
          icon={grid.secondaryTreeIcon}
          name={grid.secondaryTreeName}
          rows={grid.secondaryRows}
        />
        <ShardColumn rows={grid.shardRows} />
      </div>
    </div>
  );
}

function ItemImage({ itemId, version, sold }: { itemId: number; version: string; sold: boolean }) {
  return (
    <span
      title={sold ? "판매한 아이템" : undefined}
      className={`relative block h-8 w-8 shrink-0 overflow-hidden rounded-md bg-[var(--ui-surface)] ${
        sold ? "opacity-30 grayscale" : ""
      }`}
    >
      <Image
        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
        alt={`아이템 ${itemId}`}
        fill
        sizes="32px"
        className="object-cover"
      />
      {sold ? <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -rotate-[35deg] bg-white/90" /> : null}
    </span>
  );
}

function purchaseTimeLabel(group: ItemPurchaseGroup, groupIndex: number) {
  if (groupIndex === 0 && group.minute === 0) return "시작";

  const timestampMs = group.purchases[0]?.timestampMs ?? 0;
  const minutes = Math.floor(timestampMs / 60_000);
  const seconds = Math.floor((timestampMs % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ItemBuild({ entry }: { entry: PlayerBuildPanelEntry }) {
  if (entry.itemPurchaseGroups.length === 0) {
    return <div className="grid min-h-28 place-items-center text-base font-normal text-[var(--ui-muted)]">구매 기록 없음</div>;
  }

  return (
    <div className="flex flex-wrap content-start items-start gap-y-3 pt-1">
      {entry.itemPurchaseGroups.map((group, groupIndex) => (
        <div key={`${group.minute}-${groupIndex}`} className="flex shrink-0 items-start">
          {groupIndex > 0 ? (
            <span className="mx-2 grid h-8 w-5 shrink-0 place-items-center rounded bg-[var(--ui-surface)] text-[var(--ui-muted)]">
              <ChevronRight aria-hidden="true" className="h-4 w-4 opacity-70" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              {group.purchases.map((purchase, purchaseIndex) => (
                <ItemImage
                  key={`${purchase.itemId}-${purchase.timestampMs}-${purchaseIndex}`}
                  itemId={purchase.itemId}
                  version={entry.version}
                  sold={purchase.sold}
                />
              ))}
            </div>
            <div className="mt-1 text-center text-[13px] font-medium tabular-nums text-[var(--ui-muted)]">
              {purchaseTimeLabel(group, groupIndex)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkillBuild({ entry }: { entry: PlayerBuildPanelEntry }) {
  if (entry.skillOrder.length === 0) {
    return <div className="grid min-h-28 place-items-center text-base font-normal text-[var(--ui-muted)]">스킬 기록 없음</div>;
  }

  const selected = new Set(entry.skillOrder.map(({ slot, level }) => `${slot}-${level}`));

  return (
    <div className="overflow-x-auto pb-0.5">
      <div className="mx-auto grid w-full min-w-[624px] max-w-[760px] grid-cols-[repeat(19,minmax(30px,1fr))] gap-[3px]">
        <span className="grid place-items-center text-[13px] font-medium text-[var(--ui-muted)]">레벨</span>
        {Array.from({ length: 18 }, (_, index) => index + 1).map((level) => (
          <span key={`level-${level}`} className="grid place-items-center text-xs font-medium tabular-nums text-[var(--ui-muted)]">
            {level}
          </span>
        ))}

        {SKILLS.map((slot) => (
          <div key={slot} className="contents">
            <div className="relative aspect-square w-full overflow-hidden rounded-md bg-[var(--ui-surface)]">
              {entry.abilityIcons?.[slot] ? (
                <Image src={entry.abilityIcons[slot]} alt="" fill sizes="36px" className="object-cover" />
              ) : null}
              <span className="absolute bottom-0 left-0 grid h-4 min-w-4 place-items-center rounded-tr bg-black/70 px-0.5 text-xs font-medium leading-none text-white">
                {SKILL_KEY[slot]}
              </span>
            </div>

            {Array.from({ length: 18 }, (_, index) => index + 1).map((level) => {
              const learned = selected.has(`${slot}-${level}`);

              return (
                <span
                  key={level}
                  className={`grid aspect-square w-full place-items-center rounded-md text-xs font-medium tabular-nums ${
                    learned
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "bg-[var(--ui-surface)] text-transparent"
                  }`}
                >
                  {learned ? level : "·"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-lg font-bold leading-6 text-[var(--ui-ink)]">{children}</h3>;
}

export function PlayerBuildPanel({ entries }: { entries: PlayerBuildPanelEntry[] }) {
  const [selectedId, setSelectedId] = useState(entries[0]?.playerId ?? "");
  const selected = entries.find((entry) => entry.playerId === selectedId) ?? entries[0];

  if (!selected) return null;

  return (
    <section className="w-full" aria-labelledby="player-build-title">
      <h2 id="player-build-title" className="home-section-title mb-3 text-xl text-[var(--ui-ink)]">
        빌드
      </h2>

      <div className="w-full overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)]">
        <PlayerTabs entries={entries} selectedId={selected.playerId} onSelect={setSelectedId} />

        <div className="grid items-stretch gap-3 px-3 pb-3 min-[1450px]:grid-cols-[42fr_58fr]">
          <div className="flex min-w-0 flex-col rounded-lg bg-[var(--ui-card-bg)] p-4">
            <SectionTitle>룬</SectionTitle>
            <Runes entry={selected} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-h-0 flex-1 rounded-lg bg-[var(--ui-card-bg)] p-4">
              <SectionTitle>아이템 빌드</SectionTitle>
              <ItemBuild entry={selected} />
            </div>

            <div className="rounded-lg bg-[var(--ui-card-bg)] p-4">
              <SectionTitle>스킬 빌드</SectionTitle>
              <SkillBuild entry={selected} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
