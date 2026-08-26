import type { ReactNode } from "react";

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSigned(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

export function SampleBadge({ games }: { games: number }) {
  if (games >= 5) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-normal text-amber-700 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      {games <= 2 ? "표본 매우 적음" : "표본 적음"}
    </span>
  );
}

export function SectionCard({
  title,
  caption,
  action,
  children,
  className = "",
}: {
  title: string;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-paperozi text-[20px] leading-tight text-[var(--ui-ink)]">{title}</h2>
          {caption ? <div className="mt-1 text-[13px] font-normal leading-5 text-[var(--ui-muted)]">{caption}</div> : null}
        </div>
        {action}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
        {children}
      </div>
    </section>
  );
}

export function PercentageBar({
  value,
  max = 100,
  tone = "accent",
}: {
  value: number;
  max?: number;
  tone?: "accent" | "blue" | "red";
}) {
  const width = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const color = tone === "blue" ? "bg-blue-500" : tone === "red" ? "bg-rose-500" : "bg-[var(--accent)]";
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--ui-card-bg)]">
      <span className={`block h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </span>
  );
}

export function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-48 place-items-center px-5 py-10 text-center">
      <div>
        <p className="text-[18px] font-bold text-[var(--ui-ink)]">{title}</p>
        <p className="mt-2 max-w-lg text-[16px] font-normal leading-7 text-[var(--ui-muted)]">{body}</p>
      </div>
    </div>
  );
}
