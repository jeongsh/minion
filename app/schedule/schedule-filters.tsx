"use client";

import Link from "next/link";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { TournamentMark } from "@/app/tournaments/tournament-mark";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { useRouter, useSearchParams } from "next/navigation";
import { TournamentOptionMark } from "@/app/tournaments/tournament-mark";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { EventFilterField } from "@/components/ui/event-filter-field";
import { TeamLogo } from "@/components/ui/team-logo";
import { SEASON_2026_SEGMENTS } from "@/lib/tournaments/season-2026";
import type { Team } from "@/lib/types";

const months = Array.from({ length: 12 }, (_, index) => index + 1);

export function ScheduleFilters({
  activeYear, activeMonth, activeSegment, years, teams,
  activeTeam = "all", pathname = "/schedule", lockTeam = false, layout = "bar",
}: {
  activeYear: number;
  activeMonth: number;
  activeSegment: string;
  years: number[];
  teams: Team[];
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
    return `${pathname}?${params}`;
  }

  function navigate(next: { year?: number; month?: number; segment?: string; team?: string }) {
    const href = filterHref(next);
    if (startNavigation(href)) router.push(href, { scroll: false });
  }

  if (layout === "sheet") {
    const chipClass = (active: boolean) => `flex min-h-10 min-w-0 items-center justify-center rounded-xl border px-2 transition-colors ${active ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "border-[var(--ui-border)] bg-[var(--ui-card-bg)] text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)]"}`;
    return <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1.5"><span className="text-sm font-medium text-muted">연도</span><FilterDropdown ariaLabel="연도 선택" selected={String(activeYear)} options={years.map(year => ({ value: String(year), label: String(year) }))} onSelect={value => navigate({ year: Number(value) })} disabled={isNavigating} triggerClassName="w-full" /></div>
        <div className="grid gap-1.5"><span className="text-sm font-medium text-muted">월</span><FilterDropdown ariaLabel="월 선택" selected={String(activeMonth)} options={months.map(month => ({ value: String(month), label: `${month}월` }))} onSelect={value => navigate({ month: Number(value) })} disabled={isNavigating} triggerClassName="w-full" /></div>
      </div>
      <section><h3 className="mb-2 text-[13px] font-medium text-[var(--ui-muted)]">대회</h3><div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2">
        {SEASON_2026_SEGMENTS.map(segment => {
          const theme = segmentThemeByKey(segment.key === "lck-cup" ? "lck" : segment.key);
          return <Link key={segment.key} href={filterHref({ segment: segment.key })} scroll={false} aria-label={`${segment.key === "all" ? "전체 대회" : segment.label} 선택`} aria-current={activeSegment === segment.key ? "true" : undefined} title={segment.label} className={chipClass(activeSegment === segment.key)}>{theme?.logo ? <TournamentMark logo={theme.logo} aspect={theme.logoAspect} className="h-5 max-w-[34px]" /> : <span className="text-[13px] font-medium">전체</span>}</Link>;
        })}
      </div></section>
      <section><h3 className="mb-2 text-[13px] font-medium text-[var(--ui-muted)]">팀</h3><div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
        {!lockTeam ? <Link href={filterHref({ team: "all" })} scroll={false} className={chipClass(activeTeam === "all")}><span className="text-[13px] font-medium">전체</span></Link> : null}
        {teams.filter(team => team.isLckTeam !== false).map(team => <Link key={team.id} href={filterHref({ team: team.id })} scroll={false} aria-label={`${team.shortName || team.name} 선택`} aria-current={activeTeam === team.id ? "true" : undefined} title={team.name} className={chipClass(activeTeam === team.id)}><TeamLogo team={activeTeam === team.id && team.logoWhiteUrl ? { ...team, logoUrl: team.logoWhiteUrl } : team} size="h-7 w-7" plain themeAware={activeTeam !== team.id} /></Link>)}
      </div></section>
    </div>;
  }

  return (
    <>
      <EventFilterField
        label="연도"
        selected={String(activeYear)}
        options={years.map((year) => ({ value: String(year), label: String(year) }))}
        onSelect={(value) => navigate({ year: Number(value) })}
        disabled={isNavigating}
      />
      <EventFilterField
        label="월"
        variant="grid"
        selected={String(activeMonth)}
        options={months.map((month) => ({ value: String(month), label: `${month}월` }))}
        onSelect={(value) => navigate({ month: Number(value) })}
        disabled={isNavigating}
      />
      <EventFilterField
        label="대회"
        selected={activeSegment}
        options={SEASON_2026_SEGMENTS.map((segment) => ({ value: segment.key, label: segment.key === "all" ? "전체 대회" : segment.label, icon: segment.key === "all" ? undefined : <TournamentOptionMark segmentKey={segment.key} /> }))}
        onSelect={(value) => navigate({ segment: value })}
        disabled={isNavigating}
      />
      <EventFilterField
        label="팀"
        selected={activeTeam}
        options={[
          ...(lockTeam ? [] : [{ value: "all", label: "전체 팀" }]),
          ...teams.filter((team) => team.isLckTeam !== false).map((team) => ({ value: team.id, label: team.shortName || team.name, icon: <TeamLogo team={team} size="h-5 w-5" plain themeAware /> })),
        ]}
        onSelect={(value) => navigate({ team: value })}
        disabled={isNavigating || lockTeam}
      />
    </>
  );
}
