"use client";
import { TableValue } from "@/components/ui/table";

import { useId, useState, type ReactNode } from "react";

import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import { TeamLogo } from "@/components/ui/team-logo";
import { SegmentedToggle } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
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
  const tableId = useId();
  const stats = enableMobileStats && mobileView === "stats";
  const maxDamage =
    suppliedMaxDamage ??
    Math.max(
      ...groups.flatMap((group) => group.rows.map((row) => row.damage)),
      1,
    );
  const statsColumn = stats ? "" : "hidden min-[1280px]:table-cell";
  const itemColumn = stats ? "hidden min-[1280px]:table-cell" : "";
  return (
    <div className={className}>
      {heading || enableMobileStats ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {heading}
          {enableMobileStats ? (
            <div className="ml-auto min-[1280px]:hidden">
              <SegmentedToggle
                items={[
                  { key: "basic", label: "기본" },
                  { key: "stats", label: "통계" },
                ]}
                activeKey={mobileView}
                ariaLabel="선수 스탯 보기"
                controlsId={tableId}
                onSelect={setMobileView}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div id={tableId} className="space-y-3">
        {groups.map((group) => (
          <DataTable
            key={group.id}
            rows={group.rows}
            compact
            framed={framed}
            columns={[
              {
                key: "player",
                label: (
                  <span className="flex items-center gap-2">
                    {group.team ? (
                      <TeamLogo
                        team={group.team}
                        size="h-5 w-5"
                        plain
                        themeAware
                      />
                    ) : null}
                    {group.label}
                    {group.won ? (
                      <span className="text-xs font-medium text-accent">
                        WIN
                      </span>
                    ) : null}
                  </span>
                ),
                render: (row) => (
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
                    size="sm"
                  />
                ),
              },
              {
                align: "center",
                key: "kda",
                label: "KDA",
                render: (row) => (
                  <TableValue
                    value={row.kills + " / " + row.deaths + " / " + row.assists}
                    detail={row.kda.toFixed(2)}
                  />
                ),
              },
              {
                key: "damage",
                label: "데미지",
                headerClassName: statsColumn,
                cellClassName: statsColumn,
                render: (row) => (
                  <div className="min-w-28">
                    <div className="flex justify-between gap-3 tabular-nums">
                      <span>{numberLabel(row.damage)}</span>
                      <span className="text-[13px] text-muted">
                        DPM {numberLabel(row.dpm)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                      aria-hidden="true"
                    >
                      <div
                        className={
                          (row.accent ?? group.accent ?? "blue") === "blue"
                            ? "h-full bg-team-blue"
                            : "h-full bg-team-red"
                        }
                        style={{
                          width:
                            Math.min(
                              100,
                              Math.max(0, (row.damage / maxDamage) * 100),
                            ) + "%",
                        }}
                      />
                    </div>
                  </div>
                ),
              },
              {
                align: "center",
                key: "vision",
                label: "시야",
                headerClassName: statsColumn,
                cellClassName: statsColumn,
                render: (row) => numberLabel(row.visionScore),
              },
              {
                align: "center",
                key: "cs",
                label: "CS",
                headerClassName: statsColumn,
                cellClassName: statsColumn,
                render: (row) => (
                  <TableValue value={row.cs} detail={row.csm.toFixed(1)} />
                ),
              },
              {
                align: "center",
                key: "gold",
                label: "골드",
                headerClassName: statsColumn,
                cellClassName: statsColumn,
                render: (row) => numberLabel(row.gold),
              },
              {
                key: "items",
                label: "아이템",
                headerClassName: itemColumn,
                cellClassName: itemColumn,
                render: (row) => (
                  <>
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
                      className="hidden min-[720px]:flex"
                      slotClassName="h-8 w-8"
                      imageSizes="32px"
                    />
                  </>
                ),
              },
            ]}
          />
        ))}
      </div>
    </div>
  );
}
