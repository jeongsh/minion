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
    <span className="inline-flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={championImageUrl(row.champion)} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
      <span className="font-semibold text-[var(--ui-ink)]">{championLabel(row.champion)}</span>
    </span>
  );
}

export function ChampionUsageTable({ rows, initialRows = 5 }: { rows: ChampionUsageRow[]; initialRows?: number }) {
  const [visibleCount, setVisibleCount] = useState(initialRows);
  const visibleRows = rows.slice(0, visibleCount);
  const remainingCount = Math.max(rows.length - visibleCount, 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--ui-border)] py-10 text-center text-sm text-[var(--ui-muted)]">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--ui-border)] text-xs font-semibold text-[var(--ui-muted)]">
            <th scope="col" className="min-w-[9rem] px-3 py-2.5 font-semibold">챔피언</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">사용 세트</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">승률</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">KDA</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">평균 팬 평점</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">팬 POG</th>
            <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-center font-semibold">최근 사용일</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => (
            <tr key={row.champion?.id ?? index} className="border-b border-[var(--ui-border)] align-middle">
              <td className="min-w-[9rem] px-3 py-3"><ChampionCell row={row} /></td>
              <td className="px-3 py-3 text-center tabular-nums text-[var(--ui-ink)]">{row.lines.length}</td>
              <td className="px-3 py-3 text-center font-semibold tabular-nums text-[var(--tp)]">{percentValue(row.winRate)}</td>
              <td className="px-3 py-3 text-center tabular-nums text-[var(--ui-ink)]">{statValue(row.stats?.kda, 2)}</td>
              <td className="px-3 py-3 text-center tabular-nums text-[var(--ui-text)]">{row.avgRating}</td>
              <td className="px-3 py-3 text-center tabular-nums text-[var(--ui-text)]">{row.fanPogCount}</td>
              <td className="px-3 py-3 text-center text-xs tabular-nums text-[var(--ui-muted)]">{compactDate(row.recentDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount(rows.length)}
          className="mt-3 text-sm font-semibold text-[var(--ui-text)] transition-colors hover:text-[var(--ui-ink)]"
        >
          더보기 ({remainingCount}개) →
        </button>
      ) : null}
    </div>
  );
}
