"use client";

import { useEffect, useRef, useState } from "react";
import type { PowerRankingPoint } from "@/lib/power-rankings";

export function PowerRankingChart({ series, error }: {
  series: Array<{ label: string; color: string; history: PowerRankingPoint[] }>;
  error?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const points = series.flatMap((item) => item.history);
  const dates = [...new Set(points.map((point) => Date.parse(point.date)))].sort((a, b) => a - b);
  const start = dates[0], end = dates.at(-1);
  const maxRank = Math.max(5, Math.ceil(Math.max(...points.map((point) => point.rank)) / 5) * 5);
  const x = (date: string) => end === start ? (width + 16) / 2 : 32 + (Date.parse(date) - start) / (end! - start) * (width - 48);
  const y = (rank: number) => 18 + (rank - 1) / (maxRank - 1) * 228;
  const tickStep = Math.max(5, Math.ceil(maxRank / 25) * 5);
  const ticks = [1, ...Array.from({ length: Math.floor(maxRank / tickStep) }, (_, i) => (i + 1) * tickStep)];
  const formatDate = (date: string | number) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric" }).format(new Date(date));
  const visibleDates = dates.filter((_, i) => i === 0 || i === dates.length - 1 || (width >= 360 && i === Math.floor(dates.length / 2)));

  return (
    <div ref={ref} className="flex h-[280px] min-w-0 items-center justify-center" data-power-ranking-chart>
      {!points.length ? <p className="text-base text-[var(--ui-muted)]">{error ? "파워랭킹을 불러오지 못했습니다." : "파워랭킹 기록 없음"}</p> : width > 0 ? (
        <svg viewBox={`0 0 ${width} 280`} className="block h-full w-full" role="img" aria-label="발표일별 두 팀의 세계 파워랭킹 추이">
          <desc>{series.map((item) => `${item.label}: ${item.history.map((point) => `${formatDate(point.date)} ${point.rank}위`).join(", ")}`).join(". ")}</desc>
          {ticks.map((rank) => <g key={rank}><line x1="32" x2={width - 16} y1={y(rank)} y2={y(rank)} stroke="var(--ui-border)" /><text x="24" y={y(rank) + 4} textAnchor="end" className="fill-[var(--ui-muted)] text-[13px] font-normal">{rank}</text></g>)}
          {visibleDates.map((date, i) => <text key={date} x={x(new Date(date).toISOString())} y="274" textAnchor={i === 0 ? "start" : i === visibleDates.length - 1 ? "end" : "middle"} className="fill-[var(--ui-muted)] text-[13px] font-normal">{formatDate(date)}</text>)}
          {series.map((item, index) => <g key={item.label}>
            <polyline points={item.history.map((point) => `${x(point.date)},${y(point.rank)}`).join(" ")} stroke={item.color} strokeWidth="2" strokeDasharray={index ? "5 4" : undefined} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {item.history.map((point) => <circle key={point.date} cx={x(point.date)} cy={y(point.rank)} r="3" fill={item.color}><title>{`${item.label} ${formatDate(point.date)} ${point.rank}위`}</title></circle>)}
          </g>)}
        </svg>
      ) : null}
    </div>
  );
}
