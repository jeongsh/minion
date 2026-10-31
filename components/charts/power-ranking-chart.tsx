"use client";

import { LineChart } from "@/components/charts/line-chart";
import type { PowerRankingPoint } from "@/lib/power-rankings";

export function PowerRankingChart({ series, error }: {
  series: Array<{ label: string; color: string; history: PowerRankingPoint[] }>;
  error?: boolean;
}) {
  const points = series.flatMap((item) => item.history);
  const maxRank = Math.max(5, Math.ceil(Math.max(...points.map((point) => point.rank)) / 5) * 5);
  const tickStep = Math.max(5, Math.ceil(maxRank / 25) * 5);
  const ticks = [1, ...Array.from({ length: Math.floor(maxRank / tickStep) }, (_, i) => (i + 1) * tickStep)];
  const formatDate = (date: string | number) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(new Date(date));

  return (
    <div data-power-ranking-chart>
      <LineChart label="발표일별 두 팀의 세계 파워랭킹 추이" yDomain={[1, maxRank]} yTicks={ticks} reverseY
        formatX={formatDate} formatY={String} emptyText={error ? "파워랭킹을 불러오지 못했습니다." : "파워랭킹 기록 없음"}
        series={series.map((item, index) => ({ label: item.label, color: item.color, dashed: index > 0, points: item.history.map((point) => ({ x: Date.parse(point.date), y: point.rank, label: `${item.label} ${formatDate(point.date)} ${point.rank}위` })) }))} />
    </div>
  );
}
