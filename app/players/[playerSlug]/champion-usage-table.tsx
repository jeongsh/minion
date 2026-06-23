"use client";

import { useState } from "react";
import { MiniModalLink } from "@/components/domain/mini-modal-link";
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
  if (!row.champion) return "-";

  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={championImageUrl(row.champion)} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      <MiniModalLink
        href="/stats/champions"
        label={championLabel(row.champion)}
        eyebrow="챔피언 미니모달"
        title={championLabel(row.champion)}
        placement="top"
        rows={[
          { label: "픽 수", value: row.pickCount },
          { label: "밴 수", value: row.banCount },
          { label: "픽밴률", value: percentValue(row.pickBanRate) },
          { label: "승률", value: percentValue(row.winRate) },
          { label: "주요 사용 선수", value: row.mainUsers },
        ]}
        cta="챔피언 스탯 보기"
      />
    </span>
  );
}

export function ChampionUsageTable({ rows, initialRows = 5 }: { rows: ChampionUsageRow[]; initialRows?: number }) {
  const [visibleCount, setVisibleCount] = useState(initialRows);
  const visibleRows = rows.slice(0, visibleCount);
  const remainingCount = Math.max(rows.length - visibleCount, 0);

  if (rows.length === 0) {
    return <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">표시할 데이터가 없습니다.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase text-muted">
          <tr>
            <th scope="col" className="min-w-[9rem] px-4 py-3 font-semibold">챔피언</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">사용 세트 수</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">승률</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">KDA</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">평균 세트 팬 평점</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">팬 POG 횟수</th>
            <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">최근 사용일</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleRows.map((row, index) => (
            <tr key={row.champion?.id ?? index} className="align-middle">
              <td className="min-w-[9rem] px-4 py-3"><ChampionCell row={row} /></td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{row.lines.length}</td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{percentValue(row.winRate)}</td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{statValue(row.stats?.kda, 2)}</td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{row.avgRating}</td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{row.fanPogCount}</td>
              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">{compactDate(row.recentDate)}</td>
            </tr>
          ))}
          {remainingCount > 0 ? (
            <tr>
              <td colSpan={7} className="p-0">
                <button
                  type="button"
                  onClick={() => setVisibleCount(rows.length)}
                  className="block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-surface-muted"
                >
                  더보기 ({remainingCount}개)
                </button>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
