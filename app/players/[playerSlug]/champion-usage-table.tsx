"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { championLabel } from "@/lib/champions";

type ChampionLike = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  ddragonId?: string;
};

export type ChampionUsageRow = {
  champion: ChampionLike | undefined;
  lines: unknown[];
  stats: { kda: number; dpm: number; csm: number } | null;
  winRate: number | null;
  avgDamage: number | null;
  avgRating: string;
  fanPogCount: number;
  pickCount: number;
  banCount: number;
  pickBanRate: number | null;
  mainUsers: string;
};

function percentValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "-" : `${Math.round(value)}%`;
}

function statValue(value: number | null | undefined, decimals = 1) {
  return value == null || Number.isNaN(value) ? "-" : value.toFixed(decimals);
}

function numberValue(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "-" : Math.round(value).toLocaleString("ko-KR");
}

function compactNumberValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString("ko-KR");
}

function championImageUrl(champion: ChampionLike | undefined) {
  if (!champion) return "";
  if (champion.imageUrl) return champion.imageUrl;
  const fallback = champion.ddragonId || champion.slug || champion.name;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${fallback.replace(/[^A-Za-z0-9]/g, "")}_0.jpg`;
}

function ChampionCell({ row }: { row: ChampionUsageRow }) {
  if (!row.champion) return <span className="text-[var(--ui-muted)]">-</span>;

  return (
    <Link href={`/champions/${row.champion.slug}`} className="flex min-w-0 items-center justify-center gap-2 transition hover:opacity-75 sm:justify-start">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={championImageUrl(row.champion)} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
      <span className="hidden truncate font-semibold text-[var(--ui-ink)] sm:inline">{championLabel(row.champion)}</span>
    </Link>
  );
}

export function ChampionUsageTable({ rows, initialRows = 5 }: { rows: ChampionUsageRow[]; initialRows?: number }) {
  const [visibleCount, setVisibleCount] = useState(initialRows);
  const visibleRows = rows.slice(0, visibleCount);
  const remainingCount = Math.max(rows.length - visibleCount, 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--ui-border)] py-8 text-center text-sm text-[var(--ui-muted)] sm:rounded-2xl">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[var(--ui-border)]">
        <div className="overflow-hidden bg-[var(--ui-surface)]">
          <table className="w-full table-fixed border-collapse text-left text-xs lg:text-sm">
            <colgroup>
              <col className="w-[16%] sm:w-[18%]" />
              <col className="w-[10%] sm:w-[9%]" />
              <col className="w-[11%] sm:w-[9%]" />
              <col className="w-[11%] sm:w-[9%]" />
              <col className="w-[16%] sm:w-[12%]" />
              <col className="w-[12%] sm:w-[11%]" />
              <col className="w-[12%] sm:w-[10%]" />
              <col className="hidden w-[11%] sm:table-column" />
              <col className="w-[12%] sm:w-[11%]" />
            </colgroup>
            <thead>
              <tr className="h-10 bg-[var(--ui-card-bg)] text-xs font-medium leading-tight text-[var(--ui-muted)] lg:text-sm">
                <th scope="col" className="px-1.5 font-semibold sm:px-2 lg:px-3">챔피언</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">세트</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">승률</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">KDA</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">대미지</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">DPM</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">CSM</th>
                <th scope="col" className="hidden px-1 text-center font-semibold sm:table-cell sm:px-2 lg:px-3">팬평점</th>
                <th scope="col" className="px-1 text-center font-semibold sm:px-2 lg:px-3">
                  <span className="sm:hidden">POG</span>
                  <span className="hidden sm:inline">팬 POG</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ui-border)] bg-[var(--ui-surface)]">
              {visibleRows.map((row, index) => (
                <tr key={row.champion?.id ?? index} className="align-middle transition-colors hover:bg-[var(--ui-surface-muted)]">
                  <td className="px-1 py-2 sm:px-2 lg:px-3"><ChampionCell row={row} /></td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-ink)] sm:px-2 lg:px-3">{row.lines.length}</td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--tp)] sm:px-2 lg:px-3">{percentValue(row.winRate)}</td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-ink)] sm:px-2 lg:px-3">{statValue(row.stats?.kda, 2)}</td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-text)] sm:px-2 lg:px-3">
                    <span className="sm:hidden">{compactNumberValue(row.avgDamage)}</span>
                    <span className="hidden sm:inline">{numberValue(row.avgDamage)}</span>
                  </td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-text)] sm:px-2 lg:px-3">{statValue(row.stats?.dpm, 1)}</td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-text)] sm:px-2 lg:px-3">{statValue(row.stats?.csm, 1)}</td>
                  <td className="hidden px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-text)] sm:table-cell sm:px-2 lg:px-3">{row.avgRating}</td>
                  <td className="px-1 py-2 text-center font-semibold tabular-nums text-[var(--ui-text)] sm:px-2 lg:px-3">{row.fanPogCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount(rows.length)}
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--ui-card-bg)] text-sm font-bold text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]"
        >
          전체보기
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
