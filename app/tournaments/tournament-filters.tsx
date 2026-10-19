"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { EventFilterField } from "@/components/ui/event-filter-field";
import { TournamentOptionMark } from "./tournament-mark";

export type TournamentFilter = {
  label: string;
  selected: string;
  options: { value: string; label: string; href: string; isOngoing?: boolean }[];
};

export function TournamentFilters({ filters, layout = "bar" }: { filters: TournamentFilter[]; layout?: "bar" | "sheet" }) {
  const router = useRouter();
  const { isNavigating, startNavigation } = useNavigationTransition();
  if (layout === "sheet") return <div className="space-y-4">{filters.map(filter => <section key={filter.label}>
    <h3 className="mb-2 text-[13px] font-medium text-[var(--ui-muted)]">{filter.label}</h3>
    <div className="flex flex-wrap gap-2">{filter.options.map(option => <Link key={option.value} href={option.href} scroll={false} aria-current={filter.selected === option.value ? "true" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${filter.selected === option.value ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-card-bg)] text-[var(--ui-ink)] hover:bg-[var(--ui-card-hover)]"}`}>
      {filter.label === "대회" ? <TournamentOptionMark segmentKey={option.value} /> : null}{option.label}
      {option.isOngoing ? <span role="img" aria-label="진행 중" className="size-1.5 shrink-0 rounded-full bg-emerald-500" /> : null}
    </Link>)}</div>
  </section>)}</div>;
  return filters.map((filter) => (
    <EventFilterField
      key={filter.label}
      {...filter}
      options={filter.options.map((option) => ({
        ...option,
        icon: filter.label === "대회" ? <TournamentOptionMark segmentKey={option.value} /> : undefined,
        indicator: option.isOngoing ? <span role="img" aria-label="진행 중" title="진행 중" className="size-1.5 shrink-0 rounded-full bg-emerald-500 motion-safe:animate-pulse" /> : undefined,
      }))}
      disabled={isNavigating}
      onSelect={(value) => {
        const href = filter.options.find((option) => option.value === value)?.href;
        if (href && startNavigation(href)) router.push(href, { scroll: false });
      }}
    />
  ));
}
