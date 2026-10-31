import type { ReactNode } from "react";
import { ChartReveal } from "@/components/charts/chart-reveal";

export const CHART_CARD_SURFACE = "border border-[var(--ui-border)] bg-[var(--ui-surface)] dark:bg-[var(--ui-surface-muted)]";

export function ChartCard({ title, caption, legend, children, className = "", reveal = true }: {
  title: string;
  caption?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  className?: string;
  reveal?: boolean;
}) {
  const contentClassName = "mt-4 flex min-w-0 flex-1 flex-col justify-center";
  return (
    <figure className={`flex min-w-0 flex-col rounded-xl ${CHART_CARD_SURFACE} p-4 sm:p-5 ${className}`}>
      <figcaption className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold leading-7 text-[var(--ui-ink)]">{title}</h3>
          {caption ? <p className="mt-0.5 text-[13px] font-medium leading-5 text-[var(--ui-muted)]">{caption}</p> : null}
        </div>
        {legend ? <div className="shrink-0 pt-1">{legend}</div> : null}
      </figcaption>
      {reveal ? <ChartReveal className={contentClassName}>{children}</ChartReveal> : <div className={contentClassName}>{children}</div>}
    </figure>
  );
}
