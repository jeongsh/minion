"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Divider, FilterDropdown } from "@/components/match-filter-dropdown";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { SEASON_2026_SEGMENTS } from "@/lib/tournaments/season-2026";

const months = Array.from({ length: 12 }, (_, index) => index + 1);

export function ScheduleFilters({
  activeYear,
  activeMonth,
  activeSegment,
  years,
  teams,
  activeTeam = "all",
  pathname = "/schedule",
  lockTeam = false,
  layout = "bar",
}: {
  activeYear: number;
  activeMonth: number;
  activeSegment: string;
  years: number[];
  teams: { id: string; name: string; shortName: string; isLckTeam?: boolean }[];
  activeTeam?: string;
  pathname?: string;
  lockTeam?: boolean;
  layout?: "bar" | "sheet";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isNavigating, startNavigation } = useNavigationTransition();

  function filterHref(next: { year?: number; month?: number; segment?: string; team?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("year", String(next.year ?? activeYear));
    params.set("month", String(next.month ?? activeMonth));

    const segment = next.segment ?? activeSegment;
    if (segment === "all") params.delete("segment");
    else params.set("segment", segment);

    const team = next.team ?? activeTeam;
    if (team === "all") params.delete("team");
    else params.set("team", team);

    return `${pathname}?${params.toString()}`;
  }

  function navigate(next: { year?: number; month?: number; segment?: string; team?: string }) {
    const href = filterHref(next);
    if (startNavigation(href)) {
      router.push(href, { scroll: false });
    }
  }

  const segmentOptions = SEASON_2026_SEGMENTS.map((segment) => ({
    value: segment.key,
    label: segment.key === "all" ? "전체" : segment.label,
  }));
  const teamOptions = [
    ...(lockTeam ? [] : [{ value: "all", label: "전체 팀" }]),
    ...teams.filter((team) => team.isLckTeam !== false).map((team) => ({ value: team.id, label: team.shortName || team.name })),
  ];
  const barTriggerClassName = "md:min-h-11 md:px-0 md:text-xl md:font-black";

  if (layout === "sheet") {
    return (
      <div className="space-y-5">
        <FilterGroup title="연도">
          <div className="grid grid-cols-2 gap-2">
            {years.map((year) => (
              <FilterLink key={year} href={filterHref({ year })} active={year === activeYear}>
                {year}
              </FilterLink>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="월">
          <div className="grid grid-cols-4 gap-2">
            {months.map((month) => (
              <FilterLink key={month} href={filterHref({ month })} active={month === activeMonth}>
                {month}월
              </FilterLink>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="대회">
          <div className="grid grid-cols-1 gap-2">
            {segmentOptions.map((option) => (
              <FilterLink key={option.value} href={filterHref({ segment: option.value })} active={option.value === activeSegment}>
                {option.label}
              </FilterLink>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="팀">
          <div className="grid grid-cols-2 gap-2">
            {teamOptions.map((option) => (
              <FilterLink key={option.value} href={filterHref({ team: option.value })} active={option.value === activeTeam}>
                {option.label}
              </FilterLink>
            ))}
          </div>
        </FilterGroup>
      </div>
    );
  }

  return (
    <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none] sm:flex-wrap sm:gap-x-5 sm:gap-y-2 [&::-webkit-scrollbar]:hidden">
      <FilterDropdown
        ariaLabel="연도 선택"
        selected={String(activeYear)}
        options={years.map((year) => ({ value: String(year), label: `${year}` }))}
        onSelect={(value) => navigate({ year: Number(value) })}
        disabled={isNavigating}
        triggerClassName={barTriggerClassName}
      />

      <Divider />

      <FilterDropdown
        ariaLabel="월 선택"
        variant="grid"
        selected={String(activeMonth)}
        options={months.map((month) => ({ value: String(month), label: `${month}월` }))}
        onSelect={(value) => navigate({ month: Number(value) })}
        disabled={isNavigating}
        triggerClassName={barTriggerClassName}
      />

      <Divider />

      <FilterDropdown
        ariaLabel="대회 선택"
        selected={activeSegment}
        options={segmentOptions}
        onSelect={(value) => navigate({ segment: value })}
        disabled={isNavigating}
        triggerClassName={barTriggerClassName}
      />

      <Divider />

      <FilterDropdown
        ariaLabel="팀 선택"
        selected={activeTeam}
        options={teamOptions}
        onSelect={(value) => navigate({ team: value })}
        disabled={isNavigating || lockTeam}
        triggerClassName={barTriggerClassName}
      />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-black text-[var(--ui-muted)]">{title}</h3>
      {children}
    </section>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-center text-[14px] font-black transition-colors ${
        active
          ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
          : "border-[var(--ui-border)] bg-[var(--ui-surface-muted)] text-[var(--ui-ink)] hover:bg-[var(--ui-surface)]"
      }`}
    >
      {children}
    </Link>
  );
}
