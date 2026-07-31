"use client";

import type { ReactNode } from "react";

import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import { championLabel } from "@/lib/champions";
import type { RuneCatalog } from "@/lib/runes";
import type { GameSpell } from "@/lib/spells";
import type { Champion } from "@/lib/types";

type CompactStats = {
  kda: number;
  csm: number;
};

type CompactLine = {
  spellIds: Array<number | null | undefined>;
  runeIds: Array<number | null | undefined>;
  itemIds: Array<number | null | undefined>;
  roleBoundItem: number | null | undefined;
  championLevel?: number | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold?: number | null;
};

export function ResponsivePlayerStatRow({
  champion,
  line,
  stats,
  spells,
  version,
  runeCatalog,
  title,
  subtitle,
  trailing,
  detail,
  stackItemsOnSmall = false,
  itemSlotClassName = "h-[18px] w-[18px]",
  itemSeparatorClassName = "h-3.5 w-px",
  itemImageSizes = "18px",
}: {
  champion?: Champion;
  line: CompactLine;
  stats: CompactStats;
  spells: GameSpell[];
  version: string;
  runeCatalog: RuneCatalog;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  detail?: ReactNode;
  stackItemsOnSmall?: boolean;
  itemSlotClassName?: string;
  itemSeparatorClassName?: string;
  itemImageSizes?: string;
}) {
  return (
    <div data-player-stat-row="compact" className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-2 text-[13px] even:bg-surface-muted/15 sm:gap-3 sm:px-3 min-[720px]:grid-cols-[17rem_auto] min-[720px]:justify-center min-[720px]:gap-6">
      <PlayerLoadout
        champion={champion}
        spellIds={line.spellIds}
        runeIds={line.runeIds}
        spells={spells}
        version={version}
        runeCatalog={runeCatalog}
        primaryLabel={title}
        secondaryLabel={
          subtitle ?? `${line.kills} / ${line.deaths} / ${line.assists} · ${stats.kda.toFixed(2)}`
        }
        badge={line.championLevel != null ? `${line.championLevel}` : undefined}
        size="sm"
        className="gap-1.5 [&>span:first-child]:gap-0.5 [&>span:first-child>span:first-child]:h-10 [&>span:first-child>span:first-child]:w-10 [&>span:first-child>span:nth-child(2)_span]:h-5 [&>span:first-child>span:nth-child(2)_span]:w-5"
      />

      <div className="grid min-w-0 justify-items-end gap-0.5 min-[720px]:justify-items-start">
        <div className={stackItemsOnSmall ? "hidden min-[480px]:block" : ""}>
          <PlayerItemSlots
            itemIds={line.itemIds}
            roleBoundItem={line.roleBoundItem}
            version={version}
            className="justify-end"
            slotClassName={itemSlotClassName}
            separatorClassName={itemSeparatorClassName}
            imageSizes={itemImageSizes}
          />
        </div>
        <div className="flex max-w-full items-center justify-end gap-1.5 text-[13px] font-semibold text-muted">
          <span className="tabular-nums">{line.cs}</span>
          <span className="text-muted/60">CS</span>
          <span className="tabular-nums">{stats.csm.toFixed(1)}</span>
          {trailing ? <span className="min-w-0 truncate">{trailing}</span> : null}
        </div>
      </div>

      {stackItemsOnSmall ? (
        <div className="col-span-2 flex justify-end min-[480px]:hidden">
          <PlayerItemSlots
            itemIds={line.itemIds}
            roleBoundItem={line.roleBoundItem}
            version={version}
            className="justify-end"
            slotClassName={itemSlotClassName}
            separatorClassName={itemSeparatorClassName}
            imageSizes={itemImageSizes}
          />
        </div>
      ) : null}

      {detail ? <div className="col-span-2 min-w-0">{detail}</div> : null}
    </div>
  );
}

export function defaultPlayerStatTitle({
  teamName,
  playerName,
  champion,
}: {
  teamName?: string;
  playerName?: string;
  champion?: Champion;
}) {
  if (teamName && playerName) return `${teamName} ${playerName}`;
  return playerName ?? (champion ? championLabel(champion) : "-");
}
