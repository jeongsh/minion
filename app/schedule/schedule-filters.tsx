"use client";

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
}: {
  activeYear: number;
  activeMonth: number;
  activeSegment: string;
  years: number[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isNavigating, startNavigation } = useNavigationTransition();

  function navigate(next: { year?: number; month?: number; segment?: string }) {
    const params = new URLSearchParams(searchParams.toString());

    params.set("year", String(next.year ?? activeYear));
    params.set("month", String(next.month ?? activeMonth));

    const segment = next.segment ?? activeSegment;
    if (segment === "all") {
      params.delete("segment");
    } else {
      params.set("segment", segment);
    }

    const href = `/schedule?${params.toString()}`;
    if (startNavigation(href)) {
      router.push(href, { scroll: false });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <FilterDropdown
        ariaLabel="년도 선택"
        selected={String(activeYear)}
        options={years.map((year) => ({ value: String(year), label: `${year}` }))}
        onSelect={(value) => navigate({ year: Number(value) })}
        disabled={isNavigating}
      />

      <Divider />

      <FilterDropdown
        ariaLabel="월 선택"
        variant="grid"
        selected={String(activeMonth)}
        options={months.map((month) => ({ value: String(month), label: `${month}월` }))}
        onSelect={(value) => navigate({ month: Number(value) })}
        disabled={isNavigating}
      />

      <Divider />

      <FilterDropdown
        ariaLabel="대회 선택"
        selected={activeSegment}
        options={SEASON_2026_SEGMENTS.map((segment) => ({
          value: segment.key,
          label: segment.key === "all" ? "전체" : segment.label,
        }))}
        onSelect={(value) => navigate({ segment: value })}
        disabled={isNavigating}
      />
    </div>
  );
}
