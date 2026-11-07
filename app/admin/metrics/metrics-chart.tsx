"use client";

import { useState } from "react";

type MetricsChartProps = {
  dates: string[];
  values: Array<number | null>;
  formatValue: (value: number) => string;
  /** 마지막 날짜가 오늘이라 아직 집계 중이면 마지막 구간을 점선으로 그린다. */
  partialLast: boolean;
};

function niceStep(max: number) {
  if (max <= 0) return 1;
  const raw = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function longDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/** 연속된 값끼리 묶는다. 값이 없는 날은 선을 끊는다. */
function segments(values: Array<number | null>) {
  const result: number[][] = [];
  let current: number[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length) result.push(current);
      current = [];
    } else {
      current.push(index);
    }
  });
  if (current.length) result.push(current);
  return result;
}

export function MetricsChart({ dates, values, formatValue, partialLast }: MetricsChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const count = dates.length;
  const numeric = values.filter((value): value is number => value !== null);
  const step = niceStep(Math.max(0, ...numeric));
  // 최고점이 위쪽 끝에 붙지 않도록 여유를 둔다.
  const top = Math.max(step * 3, step * Math.ceil((Math.max(0, ...numeric) * 1.15) / step));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);

  const x = (index: number) => (count <= 1 ? 50 : (index / (count - 1)) * 100);
  const y = (value: number) => 100 - (value / top) * 100;
  const point = (index: number) => `${x(index)},${y(values[index] ?? 0)}`;

  const lastIndex = count - 1;
  const dashed = partialLast && values[lastIndex] !== null && values[lastIndex - 1] !== null;
  const solidValues = dashed ? values.map((value, index) => (index === lastIndex ? null : value)) : values;
  const lines = segments(solidValues);
  const areas = segments(values);

  const labelEvery = Math.max(1, Math.ceil(count / 7));
  // 좁은 화면에서는 라벨을 4개 안팎만 남겨 겹치지 않게 한다.
  const mobileLabelEvery = Math.max(1, Math.ceil((count - 1) / 3));
  const hoverValue = hoverIndex === null ? null : values[hoverIndex];

  function handlePointer(event: React.PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setHoverIndex(Math.round(ratio * (count - 1)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-[200px] gap-3 sm:h-[260px]">
        <div className="relative w-10 shrink-0 text-right text-[13px] tabular-nums text-[var(--ui-muted)]">
          {ticks.map((tick) => (
            <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(tick)}%` }}>
              {tick.toLocaleString("ko-KR")}
            </span>
          ))}
        </div>

        <div
          className="relative min-w-0 flex-1 touch-pan-y"
          onPointerMove={handlePointer}
          onPointerDown={handlePointer}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t border-[var(--ui-card-divider)]"
              style={{ top: `${y(tick)}%` }}
            />
          ))}

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            role="img"
            aria-label="일별 추이"
          >
            {areas.map((segment) => (
              <polygon
                key={`area-${segment[0]}`}
                points={`${x(segment[0])},100 ${segment.map(point).join(" ")} ${x(segment[segment.length - 1])},100`}
                fill="color-mix(in srgb, var(--accent) 14%, transparent)"
              />
            ))}
            {lines.map((segment) =>
              segment.length > 1 ? (
                <polyline
                  key={`line-${segment[0]}`}
                  points={segment.map(point).join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null,
            )}
            {dashed ? (
              <polyline
                points={`${point(lastIndex - 1)} ${point(lastIndex)}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {hoverIndex !== null ? (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 border-l border-[var(--ui-border)]"
                style={{ left: `${x(hoverIndex)}%` }}
              />
              {hoverValue !== null ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--ui-surface)]"
                  style={{ left: `${x(hoverIndex)}%`, top: `${y(hoverValue)}%` }}
                />
              ) : null}
              <div
                className={`pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 whitespace-nowrap rounded-lg bg-[var(--ui-card-bg)] px-3 py-2 ${
                  x(hoverIndex) > 60 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2"
                }`}
                style={{ left: `${x(hoverIndex)}%` }}
              >
                <span className="text-[13px] text-[var(--ui-muted)]">{longDate(dates[hoverIndex])}</span>
                <span className="text-base font-bold tabular-nums text-[var(--ui-ink)]">
                  {hoverValue === null ? "집계 전" : formatValue(hoverValue)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative ml-[52px] h-5 text-[13px] tabular-nums text-[var(--ui-muted)]">
        {dates.map((date, index) => {
          const fromEnd = lastIndex - index;
          const desktop = fromEnd % labelEvery === 0;
          const mobile = fromEnd % mobileLabelEvery === 0;
          if (!desktop && !mobile) return null;
          return (
            <span
              key={date}
              className={`absolute ${mobile ? (desktop ? "" : "sm:hidden") : "hidden sm:inline"} ${
                index === 0 ? "" : index === lastIndex ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: `${x(index)}%` }}
            >
              {shortDate(date)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
