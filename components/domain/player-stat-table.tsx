"use client";

import type { ReactNode } from "react";

import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import { TeamLogo } from "@/components/ui/team-logo";
import type { RuneCatalog } from "@/lib/runes";
import type { GameSpell } from "@/lib/spells";
import type { Champion, Team } from "@/lib/types";

export type PlayerStatTableRow = {
  id: string;
  champion?: Champion;
  primaryLabel: ReactNode;
  secondaryLabel?: ReactNode;
  championLevel?: number | null;
  spellIds: Array<number | null | undefined>;
  runeIds: Array<number | null | undefined>;
  itemIds: Array<number | null | undefined>;
  roleBoundItem: number | null | undefined;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  visionScore: number;
  cs: number;
  gold: number;
  kda: number;
  dpm: number;
  csm: number;
  version: string;
  spells: GameSpell[];
  runeCatalog: RuneCatalog;
  accent?: "blue" | "red";
};

export type PlayerStatTableGroup = {
  id: string;
  label: ReactNode;
  team?: Team;
  won?: boolean;
  accent?: "blue" | "red";
  rows: PlayerStatTableRow[];
};

function numberLabel(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ko-KR");
}

function GroupIdentity({ group }: { group: PlayerStatTableGroup }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {group.team ? <TeamLogo team={group.team} size="h-5 w-5" plain themeAware /> : null}
      <strong className="min-w-0 truncate text-sm text-[var(--ui-ink)]">{group.label}</strong>
      {group.won ? <span className="text-xs font-bold text-accent">WIN</span> : null}
    </div>
  );
}

function CompactHeader({ group }: { group: PlayerStatTableGroup }) {
  return (
    <div className="grid h-10 grid-cols-[minmax(0,1fr)_3.5rem_5.25rem] items-center gap-2 bg-[color-mix(in_srgb,var(--ui-ink)_14%,var(--ui-surface))] px-2.5 text-xs font-semibold text-muted min-[480px]:grid-cols-[minmax(0,1fr)_3.5rem_6.5rem_5.25rem] min-[560px]:grid-cols-[12rem_3.5rem_minmax(6.5rem,1fr)_5.25rem] min-[720px]:grid-cols-[12rem_3.25rem_minmax(6.5rem,1fr)_auto] min-[720px]:px-3">
      <GroupIdentity group={group} />
      <span className="text-center">KDA</span>
      <span className="hidden min-[480px]:block">데미지</span>
      <span className="text-center min-[720px]:text-left">아이템</span>
    </div>
  );
}

function CompactRow({ row, maxDamage, accent }: { row: PlayerStatTableRow; maxDamage: number; accent: "blue" | "red" }) {
  const damageWidth = Math.max(4, (row.damage / maxDamage) * 100);
  const accentClass = accent === "blue" ? "bg-team-blue" : "bg-team-red";

  return (
    <div
      data-player-stat-row="compact"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_3.5rem_5.25rem] items-center gap-2 bg-[var(--ui-surface)] px-2.5 py-2 min-[480px]:grid-cols-[minmax(0,1fr)_3.5rem_6.5rem_5.25rem] min-[560px]:grid-cols-[12rem_3.5rem_minmax(6.5rem,1fr)_5.25rem] min-[720px]:grid-cols-[12rem_3.25rem_minmax(6.5rem,1fr)_auto] min-[720px]:px-3"
    >
      <PlayerLoadout
        champion={row.champion}
        spellIds={row.spellIds}
        runeIds={row.runeIds}
        spells={row.spells}
        version={row.version}
        runeCatalog={row.runeCatalog}
        primaryLabel={row.primaryLabel}
        secondaryLabel={row.secondaryLabel}
        badge={row.championLevel ?? undefined}
        size="md"
        className="gap-1.5 [&>span:first-child]:items-start [&>span:first-child]:gap-0.5 [&>span:first-child>span:first-child]:h-10 [&>span:first-child>span:first-child]:w-10 [&>span:first-child>span:nth-child(2)_span]:h-5 [&>span:first-child>span:nth-child(2)_span]:w-5 min-[720px]:[&>span:first-child>span:first-child]:h-12 min-[720px]:[&>span:first-child>span:first-child]:w-12 min-[720px]:[&>span:first-child>span:nth-child(2)_span]:h-7 min-[720px]:[&>span:first-child>span:nth-child(2)_span]:w-7"
      />

      <div className="text-center leading-tight">
        <strong className="block whitespace-nowrap text-xs tabular-nums text-[var(--ui-ink)]">
          {row.kills} / {row.deaths} / {row.assists}
        </strong>
        <span className="mt-0.5 block text-xs font-medium text-muted tabular-nums">{row.kda.toFixed(2)}</span>
      </div>

      <div className="hidden min-w-0 min-[480px]:block">
        <div className="flex items-center justify-between gap-2 text-xs">
          <strong className="tabular-nums text-[var(--ui-ink)]">{numberLabel(row.damage)}</strong>
          <span className="whitespace-nowrap text-muted tabular-nums">DPM {row.dpm}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${damageWidth}%` }} />
        </div>
        <div className="mt-1 flex justify-end gap-1 text-xs font-medium text-muted tabular-nums">
          <span>{row.cs}</span>
          <span>CS</span>
        </div>
      </div>

      <PlayerItemSlots
        itemIds={row.itemIds}
        roleBoundItem={row.roleBoundItem}
        version={row.version}
        compactGrid
        className="min-[720px]:hidden"
        slotClassName="h-5 w-5"
        imageSizes="20px"
      />
      <PlayerItemSlots
        itemIds={row.itemIds}
        roleBoundItem={row.roleBoundItem}
        version={row.version}
        className="hidden justify-end min-[720px]:flex"
        slotClassName="h-7 w-7 min-[1000px]:h-8 min-[1000px]:w-8"
        separatorClassName="h-5 w-px min-[1000px]:h-6"
        imageSizes="(min-width: 1000px) 32px, 28px"
      />
    </div>
  );
}

function DesktopHeader({ group }: { group: PlayerStatTableGroup }) {
  return (
    <div className="grid h-10 grid-cols-[13rem_5rem_minmax(8rem,1fr)_3rem_3.25rem_4.5rem_19rem] items-center gap-2 bg-[color-mix(in_srgb,var(--ui-ink)_14%,var(--ui-surface))] px-2.5 text-xs font-semibold text-muted">
      <GroupIdentity group={group} />
      <span className="text-center">KDA</span>
      <span>데미지</span>
      <span className="text-center">시야</span>
      <span className="text-center">CS</span>
      <span className="text-center">골드</span>
      <span>아이템</span>
    </div>
  );
}

function DesktopRow({ row, maxDamage, accent }: { row: PlayerStatTableRow; maxDamage: number; accent: "blue" | "red" }) {
  const damageWidth = Math.max(4, (row.damage / maxDamage) * 100);
  const accentClass = accent === "blue" ? "bg-team-blue" : "bg-team-red";

  return (
    <div className="grid grid-cols-[13rem_5rem_minmax(8rem,1fr)_3rem_3.25rem_4.5rem_19rem] items-center gap-2 bg-[var(--ui-surface)] px-2.5 py-2 text-sm transition-colors hover:bg-[var(--ui-surface-muted)]">
      <PlayerLoadout
        champion={row.champion}
        spellIds={row.spellIds}
        runeIds={row.runeIds}
        spells={row.spells}
        version={row.version}
        runeCatalog={row.runeCatalog}
        primaryLabel={row.primaryLabel}
        secondaryLabel={row.secondaryLabel}
        badge={row.championLevel ?? undefined}
        size="md"
      />
      <div className="text-center">
        <p className="font-semibold tabular-nums">{row.kills} / {row.deaths} / {row.assists}</p>
        <p className="text-xs font-semibold text-muted tabular-nums">{row.kda.toFixed(2)}</p>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold tabular-nums">{numberLabel(row.damage)}</span>
          <span className="whitespace-nowrap text-xs text-muted tabular-nums">DPM {row.dpm}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${damageWidth}%` }} />
        </div>
      </div>
      <div className="text-center font-semibold tabular-nums">{row.visionScore}</div>
      <div className="text-center">
        <p className="font-semibold tabular-nums">{row.cs}</p>
        <p className="text-xs text-muted tabular-nums">{row.csm.toFixed(1)}</p>
      </div>
      <div className="text-center font-semibold tabular-nums">{numberLabel(row.gold)}</div>
      <PlayerItemSlots
        itemIds={row.itemIds}
        roleBoundItem={row.roleBoundItem}
        version={row.version}
        className="!gap-0"
        slotClassName="h-9 w-9"
        separatorClassName="h-6 w-px"
        imageSizes="36px"
      />
    </div>
  );
}

export function PlayerStatTable({
  groups,
  maxDamage: suppliedMaxDamage,
  className = "",
  framed = true,
}: {
  groups: PlayerStatTableGroup[];
  maxDamage?: number;
  className?: string;
  framed?: boolean;
}) {
  const maxDamage = suppliedMaxDamage ?? Math.max(...groups.flatMap((group) => group.rows.map((row) => row.damage)), 1);

  return (
    <div className={className}>
      <div className={`grid gap-3 min-[1280px]:hidden ${framed ? "rounded-lg bg-[var(--ui-card-bg)] p-2" : ""}`}>
        {groups.map((group) => {
          const accent = group.accent ?? "blue";
          return (
            <div key={group.id} className="overflow-hidden rounded-lg bg-[var(--ui-surface)] [&_[data-player-stat-row]+[data-player-stat-row]]:border-t [&_[data-player-stat-row]+[data-player-stat-row]]:border-border/35">
              <CompactHeader group={group} />
              {group.rows.map((row) => <CompactRow key={row.id} row={row} maxDamage={maxDamage} accent={row.accent ?? accent} />)}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto min-[1280px]:block">
        <div className={`flex min-w-[60rem] flex-col gap-3 ${framed ? "rounded-lg bg-[var(--ui-card-bg)] p-2" : ""}`}>
          {groups.map((group) => {
            const accent = group.accent ?? "blue";
            return (
              <div key={group.id} className="overflow-hidden rounded-md bg-[var(--ui-surface)]">
                <DesktopHeader group={group} />
                <div className="divide-y divide-border/35">
                  {group.rows.map((row) => <DesktopRow key={row.id} row={row} maxDamage={maxDamage} accent={row.accent ?? accent} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
