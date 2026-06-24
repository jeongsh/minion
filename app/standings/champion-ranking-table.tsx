"use client";

import { useState } from "react";

import type { ChampionRankingMode, ChampionRankingRow } from "@/lib/champion-rankings";
import { championImage, championLabel } from "@/lib/champions";

const modeLabels: Record<ChampionRankingMode, string> = {
  combined: "밴픽 합계 순위",
  ban: "밴 순위",
  pick: "픽 순위",
};

function percentValue(value: number | null) {
  return value == null || Number.isNaN(value) ? "-" : `${value.toFixed(1)}%`;
}

export function ChampionRankingTable({
  mode,
  rows,
  initialRows = 10,
}: {
  mode: ChampionRankingMode;
  rows: ChampionRankingRow[];
  initialRows?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(initialRows);
  const visibleRows = rows.slice(0, visibleCount);
  const remainingCount = Math.max(rows.length - visibleCount, 0);
  const title = modeLabels[mode];
  const isCombined = mode === "combined";
  const colSpan = isCombined ? 8 : 4;

  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted">
          표시할 데이터가 없습니다.
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-muted">
            <tr>
              <th scope="col" className="min-w-[12rem] px-4 py-3 font-semibold">
                챔피언 순위
              </th>
              <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                포지션
              </th>
              {isCombined ? (
                <>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    픽+밴
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    픽밴률
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    픽
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    밴
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    픽률
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    밴률
                  </th>
                </>
              ) : (
                <>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    {mode === "ban" ? "밴" : "픽"}
                  </th>
                  <th scope="col" className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-semibold">
                    {mode === "ban" ? "밴률" : "픽률"}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((row) => (
              <tr key={row.champion.id} className="align-middle">
                <td className="min-w-[12rem] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 shrink-0 text-center text-xl font-black italic tabular-nums">
                      {row.rank}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={championImage(row.champion)}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                    <span className="font-semibold text-foreground">
                      {championLabel(row.champion)}
                    </span>
                  </div>
                </td>
                <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center text-muted">
                  {row.position}
                </td>
                {isCombined ? (
                  <>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-bold tabular-nums">
                      {row.totalCount}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums text-accent">
                      {percentValue(row.pickBanRate)}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">
                      {row.pickCount}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">
                      {row.banCount}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">
                      {percentValue(row.pickRate)}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums">
                      {percentValue(row.banRate)}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center font-bold tabular-nums">
                      {mode === "ban" ? row.banCount : row.pickCount}
                    </td>
                    <td className="w-[1%] whitespace-nowrap px-4 py-3 text-center tabular-nums text-accent">
                      {percentValue(mode === "ban" ? row.banRate : row.pickRate)}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {remainingCount > 0 ? (
              <tr>
                <td colSpan={colSpan} className="p-0">
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
    </section>
  );
}
