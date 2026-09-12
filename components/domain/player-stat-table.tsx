"use client";

import { useId, useState, type ReactNode } from "react";

import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import { TeamLogo } from "@/components/ui/team-logo";
import { SegmentedToggle } from "@/components/ui/tabs";
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
      {group.won ? <span className="text-xs font-medium text-accent">WIN</span> : null}
    </div>
  );
}

function CompactHeader({ group }: { group: PlayerStatTableGroup }) {
  return (
    <div className="grid h-10 grid-cols-[minmax(0,1fr)_3.5rem_5.25rem] items-center gap-2 bg-[var(--ui-card-bg)] px-2.5 text-xs font-medium text-[var(--ui-muted)] min-[480px]:grid-cols-[minmax(0,1fr)_3.5rem_6.5rem_5.25rem] min-[560px]:grid-cols-[12rem_3.5rem_minmax(6.5rem,1fr)_5.25rem] min-[720px]:grid-cols-[12rem_3.25rem_minmax(6.5rem,1fr)_auto] min-[720px]:px-3 min-[720px]:text-sm">
      <GroupIdentity group={group} />
      <span className="text-center">KDA</span>
      <span className="hidden min-[480px]:block">데미지</span>
      <span className="text-center min-[720px]:text-left">아이템</span>
    </div>
  );
}

const COMPACT_LOADOUT_CLASS = "gap-1.5 [&>span:first-child]:items-start [&>span:first-child]:gap-0.5 [&>span:first-child>span:first-child]:h-10 [&>span:first-child>span:first-child]:w-10 [&>span:first-child>span:nth-child(2)_span]:h-5 [&>span:first-child>span:nth-child(2)_span]:w-5 min-[720px]:[&>span:first-child>span:first-child]:h-12 min-[720px]:[&>span:first-child>span:first-child]:w-12 min-[720px]:[&>span:first-child>span:nth-child(2)_span]:h-7 min-[720px]:[&>span:first-child>span:nth-child(2)_span]:w-7";

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
        className={COMPACT_LOADOUT_CLASS}
      />

      <div className="text-center leading-tight">
        <strong className="block whitespace-nowrap text-xs tabular-nums text-[var(--ui-ink)] min-[720px]:text-sm min-[720px]:font-medium">
          {row.kills} / {row.deaths} / {row.assists}
        </strong>
        <span className="mt-0.5 block text-xs font-medium text-muted tabular-nums min-[720px]:text-[13px]">{row.kda.toFixed(2)}</span>
      </div>

      <div className="hidden min-h-11 min-w-0 min-[480px]:block">
        <div className="flex items-center justify-between gap-2 text-xs min-[720px]:text-sm min-[720px]:[&_strong]:font-medium">
          <strong className="tabular-nums text-[var(--ui-ink)]">{numberLabel(row.damage)}</strong>
          <span className="whitespace-nowrap text-muted tabular-nums min-[720px]:text-[13px]">DPM {row.dpm}</span>
        </div>
        <div className="mt-1 hidden h-1 overflow-hidden rounded-full bg-surface-muted min-[720px]:block">
          <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${damageWidth}%` }} />
        </div>
        <div className="mt-1 flex justify-end gap-1 text-xs font-medium text-muted tabular-nums min-[720px]:text-sm">
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

const MOBILE_STATS_GRID = "grid grid-cols-[minmax(0,1fr)_4.5rem_1.5rem_1.625rem_2.75rem] items-center gap-0.5 min-[360px]:gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_5rem_3rem_4rem_4rem] min-[720px]:grid-cols-[minmax(0,2fr)_4rem_minmax(5rem,1.2fr)_3rem_4rem_4rem] min-[720px]:gap-3";

function MobileStatsRow({ row, maxDamage, accent }: { row: PlayerStatTableRow; maxDamage: number; accent: "blue" | "red" }) {
  const damageWidth = maxDamage > 0 ? Math.min(100, Math.max(0, (row.damage / maxDamage) * 100)) : 0;
  const accentClass = accent === "blue" ? "bg-team-blue" : "bg-team-red";

  return (
    <div data-player-stat-row="stats" className="min-w-0 bg-[var(--ui-surface)] px-2.5 py-2 min-[720px]:px-3">
      <div className={`${MOBILE_STATS_GRID} min-h-[42px] text-xs font-medium leading-4 tabular-nums text-[var(--ui-ink)] min-[480px]:min-h-11 min-[720px]:min-h-[52px] min-[720px]:text-sm min-[720px]:leading-5`}>
        <PlayerLoadout
          champion={row.champion}
          spellIds={row.spellIds}
          runeIds={row.runeIds}
          spells={row.spells}
          version={row.version}
          runeCatalog={row.runeCatalog}
          primaryLabel={row.primaryLabel}
          secondaryLabel={<><span aria-label={`KDA ${row.kills}/${row.deaths}/${row.assists}`} className="block whitespace-nowrap text-xs font-medium leading-4 min-[720px]:hidden">{row.kills}/{row.deaths}/{row.assists}</span><span className="hidden min-[720px]:block">{row.secondaryLabel}</span></>}
          badge={row.championLevel ?? undefined}
          size="md"
          showSpellsAndRunes={false}
          className={COMPACT_LOADOUT_CLASS}
        />
        <div className="hidden text-center min-[720px]:block" aria-label={`KDA ${row.kills}/${row.deaths}/${row.assists}`}>
          <p className="whitespace-nowrap">{row.kills}/{row.deaths}/{row.assists}</p>
          <p className="text-[13px] font-normal text-muted">{row.kda.toFixed(2)}</p>
        </div>
        <div className="h-10 min-w-0 text-right min-[480px]:h-11 min-[720px]:h-12" aria-label={`데미지 ${numberLabel(row.damage)}, 분당 ${numberLabel(row.dpm)}`}>
          <p>{numberLabel(row.damage)}</p>
          <div className="mt-1 hidden h-1 w-full overflow-hidden rounded-full bg-surface-muted min-[720px]:block" aria-hidden="true">
            <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${damageWidth}%` }} />
          </div>
          <span className="block whitespace-nowrap text-xs font-medium leading-4 text-muted min-[720px]:text-[13px]">DPM {numberLabel(row.dpm)}</span>
        </div>
        <p className="h-10 text-right min-[480px]:h-11" aria-label={`시야 ${numberLabel(row.visionScore)}`}>{numberLabel(row.visionScore)}</p>
        <div className="h-10 text-right min-[480px]:h-11" aria-label={`CS ${numberLabel(row.cs)}, 분당 ${row.csm.toFixed(1)}`}>
          <p>{numberLabel(row.cs)}</p>
          <span className="block text-xs font-medium leading-4 text-muted min-[720px]:text-[13px]">{row.csm.toFixed(1)}</span>
        </div>
        <p className="h-10 text-right min-[480px]:h-11" aria-label={`골드 ${numberLabel(row.gold)}`}>{numberLabel(row.gold)}</p>
      </div>
    </div>
  );
}

function DesktopHeader({ group }: { group: PlayerStatTableGroup }) {
  return (
    <div className="grid h-10 grid-cols-[13rem_5rem_minmax(8rem,1fr)_3rem_3.25rem_4.5rem_19rem] items-center gap-2 bg-[var(--ui-card-bg)] px-2.5 text-sm font-semibold text-[var(--ui-muted)]">
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
        <p className="text-xs font-medium text-muted tabular-nums">{row.kda.toFixed(2)}</p>
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
  enableMobileStats = false,
  heading,
}: {
  groups: PlayerStatTableGroup[];
  maxDamage?: number;
  className?: string;
  framed?: boolean;
  enableMobileStats?: boolean;
  heading?: ReactNode;
}) {
  const [mobileView, setMobileView] = useState<"basic" | "stats">("basic");
  const compactTableId = useId();
  const showMobileStats = enableMobileStats && mobileView === "stats";
  const maxDamage = suppliedMaxDamage ?? Math.max(...groups.flatMap((group) => group.rows.map((row) => row.damage)), 1);

  return (
    <div className={className}>
      {heading || enableMobileStats ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {heading}
          {enableMobileStats ? (
            <div className="ml-auto min-[1280px]:hidden">
              <SegmentedToggle
                items={[{ key: "basic", label: "기본" }, { key: "stats", label: "통계" }]}
                activeKey={mobileView}
                ariaLabel="선수 스탯 보기"
                controlsId={compactTableId}
                onSelect={setMobileView}
              />
              <span role="status" className="sr-only">{mobileView === "stats" ? "선수 통계 보기" : "선수 기본 보기"}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div id={compactTableId} className={`grid gap-3 min-[1280px]:hidden ${framed ? "overflow-hidden rounded-lg border border-[var(--ui-border)]" : ""}`}>
        {groups.map((group) => {
          const accent = group.accent ?? "blue";
          return (
            <div key={group.id} className="overflow-hidden rounded-lg bg-[var(--ui-surface)] [&_[data-player-stat-row]+[data-player-stat-row]]:border-t [&_[data-player-stat-row]+[data-player-stat-row]]:border-border/35">
              <div className={showMobileStats ? "hidden" : undefined}>
                <CompactHeader group={group} />
                {group.rows.map((row) => <CompactRow key={row.id} row={row} maxDamage={maxDamage} accent={row.accent ?? accent} />)}
              </div>
              {showMobileStats ? (
                <div>
                  <div className={`${MOBILE_STATS_GRID} h-10 bg-[var(--ui-card-bg)] px-2.5 text-right text-xs font-medium text-muted min-[720px]:px-3 min-[720px]:text-sm [&_strong]:font-medium`}>
                    <GroupIdentity group={group} />
                    <span className="hidden text-center min-[720px]:block">KDA</span>
                    <span>데미지</span>
                    <span>시야</span>
                    <span>CS</span>
                    <span>골드</span>
                  </div>
                  {group.rows.map((row) => <MobileStatsRow key={row.id} row={row} maxDamage={maxDamage} accent={row.accent ?? accent} />)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto min-[1280px]:block">
        <div className={`flex min-w-[60rem] flex-col gap-3 ${framed ? "overflow-hidden rounded-lg border border-[var(--ui-border)]" : ""}`}>
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
