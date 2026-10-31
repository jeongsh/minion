"use client";

import { useEffect, useRef, useState } from "react";

export type LineChartPoint = { x: number; y: number; label: string };
export type LineChartSeries = { label: string; color: string; points: LineChartPoint[]; dashed?: boolean };

/** Shared geometry and styling for the match preview and personal prediction report. */
export function LineChart({ series, yDomain, yTicks, formatX, formatY, label, description, emptyText, reverseY = false, leftPadding = 32, interactive = false }: {
  series: LineChartSeries[];
  yDomain: [number, number];
  yTicks: number[];
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  label: string;
  description?: string;
  emptyText: string;
  reverseY?: boolean;
  leftPadding?: number;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const points = series.flatMap((item) => item.points.map((point) => ({ ...point, color: item.color })));
  const dates = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
  const start = dates[0], end = dates.at(-1);
  const x = (value: number) => end === start ? (leftPadding + width - 16) / 2 : leftPadding + (value - start) / (end! - start) * (width - leftPadding - 16);
  const y = (value: number) => {
    const fraction = (value - yDomain[0]) / (yDomain[1] - yDomain[0] || 1);
    return 18 + (reverseY ? fraction : 1 - fraction) * 228;
  };
  const visibleDates = dates.filter((_, index) => index === 0 || index === dates.length - 1 || (width >= 360 && index === Math.floor(dates.length / 2)));
  const active = activeIndex === null ? undefined : points[activeIndex];

  return <div ref={ref} className="relative flex h-[280px] min-w-0 items-center justify-center">
    {!points.length ? <p className="text-base text-[var(--ui-muted)]">{emptyText}</p> : width > 0 ? <>
      <svg viewBox={`0 0 ${width} 280`} className="block h-full w-full rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" role="img" tabIndex={interactive ? 0 : undefined} aria-label={label}
        onKeyDown={interactive ? (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          setActiveIndex((index) => event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, (index ?? points.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
        } : undefined}
        onPointerMove={interactive ? (event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          const pointerX = (event.clientX - bounds.left) / bounds.width * width;
          let nearest = 0;
          points.forEach((point, index) => { if (Math.abs(x(point.x) - pointerX) <= Math.abs(x(points[nearest].x) - pointerX)) nearest = index; });
          setActiveIndex(nearest);
        } : undefined}
        onPointerLeave={interactive ? () => setActiveIndex(null) : undefined}>
        <desc>{description ?? series.map((item) => `${item.label}: ${item.points.map((point) => point.label).join(", ")}`).join(". ")}</desc>
        {yTicks.map((tick) => <g key={tick}><line x1={leftPadding} x2={width - 16} y1={y(tick)} y2={y(tick)} stroke="var(--ui-border)" /><text x={leftPadding - 8} y={y(tick) + 4} textAnchor="end" className="fill-[var(--ui-muted)] text-[13px] font-normal">{formatY(tick)}</text></g>)}
        {visibleDates.map((date, index) => <text key={date} x={x(date)} y="274" textAnchor={index === 0 ? "start" : index === visibleDates.length - 1 ? "end" : "middle"} className="fill-[var(--ui-muted)] text-[13px] font-normal">{formatX(date)}</text>)}
        {series.map((item) => <g key={item.label}>
          <polyline points={item.points.map((point) => `${x(point.x)},${y(point.y)}`).join(" ")} stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? "5 4" : undefined} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {item.points.map((point, index) => <circle key={index} cx={x(point.x)} cy={y(point.y)} r="3" fill={item.color}><title>{point.label}</title></circle>)}
        </g>)}
        {active ? <circle cx={x(active.x)} cy={y(active.y)} r="5" fill={active.color} stroke="var(--ui-surface)" strokeWidth="2" /> : null}
      </svg>
      {active ? <div className="pointer-events-none absolute right-0 top-0 rounded-md bg-[var(--ui-ink)] px-2 py-1 text-[13px] font-normal tabular-nums text-[var(--ui-surface)]" role="status" aria-live="polite">{active.label}</div> : null}
    </> : null}
  </div>;
}
