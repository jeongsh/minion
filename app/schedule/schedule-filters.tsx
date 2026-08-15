"use client";

import { Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { TournamentMark } from "@/app/tournaments/tournament-mark";
import { Divider, FilterDropdown } from "@/components/match-filter-dropdown";
import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import { TeamLogo } from "@/components/ui/team-logo";
import { segmentThemeByKey } from "@/lib/tournaments/international-segments";
import { SEASON_2026_SEGMENTS } from "@/lib/tournaments/season-2026";
import type { Team } from "@/lib/types";

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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <FilterSelect
            label="연도"
            value={String(activeYear)}
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
            onChange={(value) => navigate({ year: Number(value) })}
            disabled={isNavigating}
          />
          <FilterSelect
            label="월"
            value={String(activeMonth)}
            options={months.map((month) => ({ value: String(month), label: `${month}월` }))}
            onChange={(value) => navigate({ month: Number(value) })}
            disabled={isNavigating}
          />
        </div>

        <FilterGroup title="대회">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-2">
            {segmentOptions.map((option) => (
              <SegmentFilterLink
                key={option.value}
                href={filterHref({ segment: option.value })}
                active={option.value === activeSegment}
                value={option.value}
                label={option.label}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="팀">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-2">
            {teamOptions.map((option) => (
              <TeamFilterLink
                key={option.value}
                href={filterHref({ team: option.value })}
                active={option.value === activeTeam}
                team={teams.find((team) => team.id === option.value)}
                label={option.label}
              />
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
      <h3 className="mb-2 text-[13px] font-bold text-[var(--ui-muted)]">{title}</h3>
      {children}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "-";

  useEffect(() => {
    if (!open) return;

    function closeOnOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function choose(nextValue: string) {
    setOpen(false);
    if (nextValue !== value) {
      onChange(nextValue);
    }
  }

  return (
    <div ref={ref} className="relative grid gap-1.5 text-[13px] font-bold text-[var(--ui-muted)]">
      <span>{label}</span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center justify-between gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-card-bg)] px-3 text-left text-[14px] font-bold text-[var(--ui-ink)] outline-none transition-colors hover:bg-[var(--ui-card-hover)] focus:border-[var(--ui-ink)] disabled:cursor-wait disabled:opacity-60"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--ui-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={`${label} 선택`}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[1010] max-h-56 overflow-y-auto rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
        >
          {options.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(option.value)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                  selected
                    ? "bg-[var(--ui-ink)] font-bold text-[var(--ui-surface)]"
                    : "font-medium text-[var(--ui-ink)] hover:bg-[var(--ui-card-hover)]"
                }`}
              >
                <span>{option.label}</span>
                {selected ? <Check size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`flex min-h-9 items-center justify-center rounded-lg border px-2 text-center text-[12px] font-medium leading-tight transition-colors sm:min-h-10 sm:px-2.5 sm:text-[13px] ${
        active
          ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
          : "border-[var(--ui-border)] bg-[var(--ui-card-bg)] text-[var(--ui-ink)] hover:bg-[var(--ui-card-hover)]"
      }`}
    >
      {children}
    </Link>
  );
}

function SegmentFilterLink({
  href,
  active,
  value,
  label,
}: {
  href: string;
  active: boolean;
  value: string;
  label: string;
}) {
  if (value === "all") {
    return (
      <FilterLink href={href} active={active}>
        전체
      </FilterLink>
    );
  }

  const theme = segmentThemeByKey(value);
  const logo = theme?.logo ?? (value === "lck-cup" ? "/logos/tournaments/lck.svg" : undefined);
  const aspect = theme?.logoAspect ?? (value === "lck-cup" ? 205.05 / 145.52 : 1.4);

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${label} 선택`}
      title={label}
      className={`grid h-10 min-w-0 place-items-center rounded-xl border px-2 transition-colors ${
        active
          ? "border-[var(--ui-ink)] bg-[var(--ui-ink)] text-[var(--ui-surface)]"
          : "border-[var(--ui-border)] bg-[var(--ui-card-bg)] text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"
      }`}
    >
      {logo ? (
        <TournamentMark logo={logo} aspect={aspect} className="h-5 max-w-[34px]" />
      ) : (
        <span className="text-[13px] font-bold">{label}</span>
      )}
    </Link>
  );
}

function TeamFilterLink({
  href,
  active,
  team,
  label,
}: {
  href: string;
  active: boolean;
  team?: Team;
  label: string;
}) {
  if (!team) {
    return (
      <FilterLink href={href} active={active}>
        전체
      </FilterLink>
    );
  }

  return (
    <Link
      href={href}
      scroll={false}
      aria-label={`${label} 선택`}
      title={label}
      className={`grid h-10 min-w-0 place-items-center rounded-xl border transition-colors ${
        active
          ? "border-[var(--ui-ink)] bg-[var(--ui-ink)]"
          : "border-[var(--ui-border)] bg-[var(--ui-card-bg)] hover:bg-[var(--ui-card-hover)]"
      }`}
    >
      {active && team.logoWhiteUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoWhiteUrl} alt={team.name} loading="lazy" decoding="async" className="h-7 w-7 object-contain" />
      ) : (
        <TeamLogo team={team} size="h-7 w-7" plain themeAware />
      )}
    </Link>
  );
}
