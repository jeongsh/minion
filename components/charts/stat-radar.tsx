export type StatRadarAxis = { label: string; title?: string };

export type StatRadarSeries = {
  label: string;
  color: string;
  scores: Array<number | null>;
  values?: string[];
  dashed?: boolean;
};

/** 선수와 팀 지표가 함께 사용하는 8축 레이더. 점수 범위는 0~100이다. */
export function StatRadar({
  axes,
  series,
  label,
  showComparisonValues = false,
  className = "",
}: {
  axes: readonly StatRadarAxis[];
  series: StatRadarSeries[];
  label: string;
  showComparisonValues?: boolean;
  className?: string;
}) {
  const center = 140;
  const maxRadius = 90;
  const pointFor = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
    const radius = (Math.max(0, Math.min(100, value)) / 100) * maxRadius;
    return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
  };

  return (
    <svg viewBox="0 0 280 280" className={`mx-auto block h-[280px] w-full max-w-[280px] shrink-0 ${className}`} role="img" aria-label={label}>
      <desc>{axes.map((axis, index) => `${axis.title ?? axis.label}: ${series.map((item) => `${item.label} ${item.values?.[index] ?? item.scores[index] ?? "기록 없음"}`).join(", ")}`).join(". ")}</desc>
      {[1, 0.75, 0.5, 0.25].map((scale, index) => (
        <polygon key={scale} points={axes.map((_, i) => pointFor(i, scale * 100)).join(" ")} fill={index % 2 === 0 ? "var(--ui-surface-muted)" : "var(--ui-surface)"} stroke="var(--ui-border)" />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = pointFor(index, 100).split(",");
        return <line key={axis.label} x1={center} y1={center} x2={x} y2={y} stroke="var(--ui-border)" />;
      })}
      {series.toReversed().map((item) => {
        const complete = axes.every((_, index) => item.scores[index] != null);
        return (
          <g key={item.label}>
            {complete ? (
              <polygon points={axes.map((_, i) => pointFor(i, item.scores[i]!)).join(" ")} fill={`color-mix(in oklab, ${item.color} 16%, transparent)`} stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? "5 4" : undefined} />
            ) : axes.map((axis, i) => {
              const next = (i + 1) % axes.length;
              if (item.scores[i] == null || item.scores[next] == null) return null;
              return <polyline key={axis.label} points={`${pointFor(i, item.scores[i]!)} ${pointFor(next, item.scores[next]!)}`} fill="none" stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? "5 4" : undefined} />;
            })}
            {axes.map((axis, i) => {
              const score = item.scores[i];
              if (score == null) return null;
              const [x, y] = pointFor(i, score).split(",");
              return <circle key={axis.label} cx={x} cy={y} r="2.5" fill={item.color}><title>{`${item.label} ${axis.title ?? axis.label}: ${item.values?.[i] ?? Math.round(score)}`}</title></circle>;
            })}
          </g>
        );
      })}
      {axes.map((axis, index) => {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
        const x = center + Math.cos(angle) * (maxRadius + 20);
        const y = center + Math.sin(angle) * (maxRadius + 16);
        const visibleSeries = showComparisonValues ? series : series.slice(0, 1);
        return (
          <text key={axis.label} x={x} y={y} textAnchor="middle" className="fill-[var(--ui-ink)] text-[13px] font-medium">
            <tspan x={x}>{axis.label}</tspan>
            <tspan x={x} dy="17" className="fill-[var(--ui-muted)]">{visibleSeries.map((item) => item.scores[index] == null ? "-" : Math.round(item.scores[index]!)).join("  ")}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
