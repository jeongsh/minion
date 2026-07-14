"use client";

import { useState } from "react";
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
  stats: { kda: number } | null;
  winRate: number | null;
  avgRating: string;
  fanPogCount: number;
  recentDate: string | undefined;
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

function compactDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
    <span className="inline-flex min-w-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={championImageUrl(row.champion)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-[30px] sm:w-[30px]" />
      <span className="truncate font-semibold text-[var(--ui-ink)]">{championLabel(row.champion)}</span>
    </span>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 border-collapse text-left text-[13px] sm:min-w-[42rem] sm:text-sm">
        <thead>
          <tr className="border-b border-[var(--ui-border)] text-[12px] font-semibold text-[var(--ui-muted)] sm:text-[13px]">
            <th scope="col" className="min-w-[7rem] px-2 py-2 font-semibold sm:min-w-[9rem] sm:px-3 sm:py-2.5">챔피언</th>
            <th scope="col" className="whitespace-nowrap px-2 py-2 text-center font-semibold sm:px-3 sm:py-2.5">사용 세트</th>
            <th scope="col" className="whitespace-nowrap px-2 py-2 text-center font-semibold sm:px-3 sm:py-2.5">승률</th>
            <th scope="col" className="whitespace-nowrap px-2 py-2 text-center font-semibold sm:px-3 sm:py-2.5">KDA</th>
            <th scope="col" className="hidden whitespace-nowrap px-3 py-2.5 text-center font-semibold sm:table-cell">팬평점</th>
            <th scope="col" className="hidden whitespace-nowrap px-3 py-2.5 text-center font-semibold sm:table-cell">팬 POG</th>
            <th scope="col" className="hidden whitespace-nowrap px-3 py-2.5 text-center font-semibold sm:table-cell">최근 사용</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={row.champion?.id ?? index} className="border-b border-[var(--ui-border)] align-middle">
              <td className="min-w-[7rem] px-2 py-2 sm:min-w-[9rem] sm:px-3 sm:py-3"><ChampionCell row={row} /></td>
              <td className="px-2 py-2 text-center tabular-nums text-[var(--ui-ink)] sm:px-3 sm:py-3">{row.lines.length}</td>
              <td className="px-2 py-2 text-center font-semibold tabular-nums text-[var(--tp)] sm:px-3 sm:py-3">{percentValue(row.winRate)}</td>
              <td className="px-2 py-2 text-center tabular-nums text-[var(--ui-ink)] sm:px-3 sm:py-3">{statValue(row.stats?.kda, 2)}</td>
              <td className="hidden px-3 py-3 text-center tabular-nums text-[var(--ui-text)] sm:table-cell">{row.avgRating}</td>
              <td className="hidden px-3 py-3 text-center tabular-nums text-[var(--ui-text)] sm:table-cell">{row.fanPogCount}</td>
              <td className="hidden px-3 py-3 text-center text-[13px] tabular-nums text-[var(--ui-muted)] sm:table-cell">{compactDate(row.recentDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount(rows.length)}
          className="mt-2 min-h-9 text-sm font-semibold text-[var(--ui-text)] transition-colors hover:text-[var(--ui-ink)]"
        >
          보기 ({remainingCount}개) →
        </button>
      ) : null}
    </div>
  );
}
