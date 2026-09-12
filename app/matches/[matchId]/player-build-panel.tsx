"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { SkillBuildTimeline } from "@/components/domain/skill-build-timeline";
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
          className={`group flex h-16 w-full min-w-0 max-w-20 flex-col items-center justify-center justify-self-center rounded-lg outline-none transition-colors focus-visible:outline-none sm:h-[72px] ${focusSurface} ${
            selected ? selectedSurface : "hover:bg-[var(--ui-card-hover)]"
          }`}
        >
          <span className="relative h-8 w-8 overflow-hidden rounded-md bg-[var(--ui-card-bg)] sm:h-10 sm:w-10">
            {entry.championImageUrl ? (
              <Image
                src={entry.championImageUrl}
                alt={entry.championName}
                fill
                sizes="(min-width: 640px) 40px, 32px"
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
    <div className="grid gap-2 px-3 pb-3 pt-3 sm:grid-cols-2 sm:gap-4 sm:px-4 sm:pt-4" aria-label="빌드 선수 선택">
      <div className="grid min-w-0 grid-cols-5 gap-1">{renderPlayers(bluePlayers)}</div>
      <div className="grid min-w-0 grid-cols-5 gap-1">{renderPlayers(redPlayers)}</div>
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
  const size = keystone ? "h-9 w-9 sm:h-10 sm:w-10" : shard ? "h-7 w-7 sm:h-8 sm:w-8" : "h-[30px] w-[30px] sm:h-[34px] sm:w-[34px]";
  const iconPadding = keystone ? "p-1" : "p-0.5";
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
          sizes={keystone ? "(min-width: 640px) 40px, 36px" : shard ? "(min-width: 640px) 32px, 28px" : "(min-width: 640px) 34px, 30px"}
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
      className={`flex items-center justify-center gap-1 sm:gap-2 ${
        keystone ? "min-h-[44px] sm:min-h-12" : shard ? "min-h-[34px] sm:min-h-[38px]" : "min-h-[38px] sm:min-h-[42px]"
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
  muted = false,
}: {
  icon?: string;
  name: string;
  rows: RuneGridOption[][];
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex h-8 items-center justify-center gap-1.5">
        {icon ? (
          <span className="relative h-[18px] w-[18px] shrink-0">
            <Image
              src={icon}
              alt=""
              fill
              sizes="18px"
              className={`object-contain ${muted ? "opacity-40 grayscale" : ""}`}
              unoptimized
            />
          </span>
        ) : null}
        <span className="text-[13px] font-medium text-[var(--ui-text)]">{name}</span>
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
    <div className="mt-2 min-w-0" aria-label="능력치 파편">
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
      <div
        className="mx-auto mt-1 grid w-full max-w-[440px] grid-cols-[minmax(max-content,1.2fr)_minmax(max-content,1fr)] items-start gap-2"
        aria-label="룬 데이터 없음"
      >
        {[0, 1].map((column) => (
          <div key={column} className="min-w-0">
            <div className="flex h-8 items-center justify-center"><span className="h-[18px] w-[18px] rounded-full bg-[#d9dce2] dark:bg-[#24272d]" /></div>
            {Array.from({ length: column === 0 ? 4 : 6 }, (_, rowIndex) => (
              <div key={rowIndex} className={`flex items-center justify-center gap-1 sm:gap-2 ${column === 0 && rowIndex === 0 ? "min-h-[44px] sm:min-h-12" : column === 1 && rowIndex >= 3 ? "min-h-[34px] sm:min-h-[38px]" : "min-h-[38px] sm:min-h-[42px]"}`}>
                {Array.from({ length: 3 }, (_, optionIndex) => (
                  <span
                    key={optionIndex}
                    className={`rounded-full bg-[#d9dce2] dark:bg-[#24272d] ${
                      column === 0 && rowIndex === 0 ? "h-9 w-9 sm:h-10 sm:w-10" : column === 1 && rowIndex >= 3 ? "h-7 w-7 sm:h-8 sm:w-8" : "h-[30px] w-[30px] sm:h-[34px] sm:w-[34px]"
                    }`}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-1 grid w-full max-w-[440px] flex-1 grid-cols-[minmax(max-content,1.2fr)_minmax(max-content,1fr)] items-start gap-2">
      <RuneColumn
        icon={grid.primaryTreeIcon}
        name={grid.primaryTreeName}
        rows={grid.primaryRows}
        primary
        muted={grid.empty}
      />
      <div className="min-w-0">
        <RuneColumn
          icon={grid.secondaryTreeIcon}
          name={grid.secondaryTreeName}
          rows={grid.secondaryRows}
          muted={grid.empty}
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
      className={`relative block h-6 w-6 shrink-0 overflow-hidden rounded-md bg-[var(--ui-surface)] ${
        sold ? "opacity-30 grayscale" : ""
      }`}
    >
      <Image
        src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`}
        alt={`아이템 ${itemId}`}
        fill
        sizes="24px"
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
    return (
      <div
        className="flex min-h-28 flex-wrap content-start items-start gap-x-2 gap-y-3 pt-1"
        aria-label="구매 기록 없음"
      >
        {[3, 2, 2, 3].map((itemCount, groupIndex) => (
          <div key={groupIndex} className="flex min-w-0 max-w-full items-start gap-2">
            {groupIndex > 0 ? (
              <span className="grid h-6 w-4 shrink-0 place-items-center rounded bg-[var(--ui-surface)] text-[var(--ui-card-divider)]">
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <div className="flex flex-wrap gap-0.5">
                {Array.from({ length: itemCount }, (_, itemIndex) => (
                  <span
                    key={itemIndex}
                    className="h-6 w-6 rounded-md bg-[var(--ui-surface)]"
                  />
                ))}
              </div>
              <div className="mx-auto mt-1 h-[13px] w-10 rounded bg-[var(--ui-surface)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap content-start items-start gap-x-2 gap-y-3 pt-1">
      {entry.itemPurchaseGroups.map((group, groupIndex) => (
        <div key={`${group.minute}-${groupIndex}`} className="flex min-w-0 max-w-full items-start gap-2">
          {groupIndex > 0 ? (
            <span
              aria-hidden="true"
              className="grid h-6 w-4 shrink-0 place-items-center rounded bg-[var(--ui-surface)] text-[var(--ui-muted)]"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4 opacity-70" />
            </span>
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-0.5">
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[15px] font-bold leading-[22px] text-[var(--ui-ink)] sm:text-[18px]">{children}</h3>;
}

export function PlayerBuildPanel({ entries }: { entries: PlayerBuildPanelEntry[] }) {
  const [selectedId, setSelectedId] = useState(entries[0]?.playerId ?? "");
  const selected = entries.find((entry) => entry.playerId === selectedId) ?? entries[0];

  if (!selected) return null;

  return (
    <section className="w-full" aria-labelledby="player-build-title">
      <h2 id="player-build-title" className="home-section-title mb-3 text-[16px] !leading-[22px] text-[var(--ui-ink)] sm:text-[20px]">
        빌드
      </h2>

      <div className="w-full overflow-hidden rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)]">
        <PlayerTabs entries={entries} selectedId={selected.playerId} onSelect={setSelectedId} />

        <div className="grid items-stretch gap-3 pb-3 sm:px-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex min-w-0 flex-col rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
            <SectionTitle>룬</SectionTitle>
            <Runes entry={selected} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="min-h-0 flex-1 rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
              <SectionTitle>아이템 빌드</SectionTitle>
              <ItemBuild entry={selected} />
            </div>

            <div className="min-w-0 rounded-lg bg-[var(--ui-card-bg)] p-3 sm:p-4">
              <SectionTitle>스킬 빌드</SectionTitle>
              <SkillBuildTimeline abilityIcons={selected.abilityIcons} skillOrder={selected.skillOrder} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
