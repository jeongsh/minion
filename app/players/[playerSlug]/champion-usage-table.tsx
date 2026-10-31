"use client";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";


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
    <Link href={`/champions/${row.champion.slug}`} className="flex min-w-0 items-center gap-2 transition hover:opacity-75">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={championImageUrl(row.champion)} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover sm:h-8 sm:w-8 lg:h-9 lg:w-9" />
      <span className="truncate font-medium text-[var(--ui-ink)]">{championLabel(row.champion)}</span>
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
      <Table className="min-w-[44rem]">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" >챔피언</TableHead>
            <TableHead scope="col" className="text-center">세트</TableHead>
            <TableHead scope="col" className="text-center">승률</TableHead>
            <TableHead scope="col" className="text-center">KDA</TableHead>
            <TableHead scope="col" className="text-center">대미지</TableHead>
            <TableHead scope="col" className="text-center">DPM</TableHead>
            <TableHead scope="col" className="text-center">CSM</TableHead>
            <TableHead scope="col" className="hidden text-center sm:table-cell">팬평점</TableHead>
            <TableHead scope="col" className="text-center">
              <span className="sm:hidden">POG</span>
              <span className="hidden sm:inline">팬 POG</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody >
          {visibleRows.map((row, index) => (
            <TableRow key={row.champion?.id ?? index} className="align-middle transition-colors">
              <TableCell ><ChampionCell row={row} /></TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-ink)]">{row.lines.length}</TableCell>
              <TableCell className="text-center tabular-nums text-[var(--tp)]">{percentValue(row.winRate)}</TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-ink)]">{statValue(row.stats?.kda, 2)}</TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-text)]">
                <span className="sm:hidden">{compactNumberValue(row.avgDamage)}</span>
                <span className="hidden sm:inline">{numberValue(row.avgDamage)}</span>
              </TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-text)]">{statValue(row.stats?.dpm, 1)}</TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-text)]">{statValue(row.stats?.csm, 1)}</TableCell>
              <TableCell className="hidden text-center tabular-nums text-[var(--ui-text)] sm:table-cell">{row.avgRating}</TableCell>
              <TableCell className="text-center tabular-nums text-[var(--ui-text)]">{row.fanPogCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {remainingCount > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount(rows.length)}
          className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--ui-card-bg)] text-sm font-medium text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-card-hover)]"
        >
          전체보기
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
