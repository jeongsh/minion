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
      <div className="mx-auto flex w-full min-w-max items-start gap-1 sm:min-w-[700px] sm:justify-between sm:gap-8">
        <div className="flex gap-1">{renderPlayers(bluePlayers)}</div>
        <span
          aria-hidden="true"
          className="mx-1 h-10 w-px shrink-0 self-center bg-[var(--ui-card-divider)] sm:hidden"
        />
        <div className="flex gap-1 sm:justify-end">{renderPlayers(redPlayers)}</div>
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
      <div className="flex h-9 items-center justify-center gap-2">
        {icon ? (
          <span className="relative h-6 w-6 shrink-0">
            <Image
              src={icon}
              alt=""
              fill
              sizes="24px"
              className={`object-contain ${muted ? "opacity-40 grayscale" : ""}`}
              unoptimized
            />
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
      <div
        className="mx-auto mt-2 grid min-h-64 w-full max-w-[480px] grid-cols-2 items-start gap-3 py-1"
        aria-label="룬 데이터 없음"
      >
        {[0, 1].map((column) => (
          <div key={column} className="min-w-0">
            <div className="mx-auto mb-2 h-6 w-6 rounded-full bg-[#d9dce2] dark:bg-[#24272d]" />
            {Array.from({ length: column === 0 ? 4 : 6 }, (_, rowIndex) => (
              <div key={rowIndex} className="flex min-h-[48px] items-center justify-center gap-2.5">
                {Array.from({ length: 3 }, (_, optionIndex) => (
                  <span
                    key={optionIndex}
                    className={`rounded-full bg-[#d9dce2] dark:bg-[#24272d] ${
                      column === 0 && rowIndex === 0 ? "h-12 w-12" : "h-8 w-8"
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
    <div className="mx-auto mt-2 grid w-full max-w-[480px] flex-1 grid-cols-2 items-start gap-3 py-1">
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
    return (
      <div
        className="flex min-h-28 flex-wrap content-start items-start gap-x-2 gap-y-3 pt-1"
        aria-label="구매 기록 없음"
      >
        {[3, 2, 2, 3].map((itemCount, groupIndex) => (
          <div key={groupIndex} className="flex shrink-0 items-start gap-2">
            {groupIndex > 0 ? (
              <span className="grid h-8 w-4 shrink-0 place-items-center rounded bg-[var(--ui-surface)] text-[var(--ui-card-divider)]">
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </span>
            ) : null}
            <div>
              <div className="flex gap-0.5">
                {Array.from({ length: itemCount }, (_, itemIndex) => (
                  <span
                    key={itemIndex}
                    className="h-8 w-8 rounded-md bg-[var(--ui-surface)]"
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
        <div key={`${group.minute}-${groupIndex}`} className="flex shrink-0 items-start gap-2">
          {groupIndex > 0 ? (
            <span
              aria-hidden="true"
              className="grid h-8 w-4 shrink-0 place-items-center rounded bg-[var(--ui-surface)] text-[var(--ui-muted)]"
            >
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
              <SkillBuildTimeline abilityIcons={selected.abilityIcons} skillOrder={selected.skillOrder} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
