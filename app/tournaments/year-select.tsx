"use client";

import { useRouter } from "next/navigation";

import { FilterDropdown } from "@/components/match-filter-dropdown";

/**
 * 시즌 선택. 예전에는 헤더 오른쪽의 연도 칩 레일이었지만, 대회 수가 늘어나면서 칩이 두 줄로
 * 밀렸다. 대회 스위처 레일 오른쪽 끝에 붙는 드롭다운 하나로 줄여 한 줄에 담는다.
 */
export function YearSelect({
  seasons,
  activeSeason,
  segmentKey,
  className = "",
}: {
  seasons: number[];
  activeSeason: number;
  segmentKey: string;
  className?: string;
}) {
  const router = useRouter();

  if (seasons.length <= 1) return null;

  return (
    <div className={`shrink-0 ${className}`}>
      <FilterDropdown
        ariaLabel="시즌 선택"
        options={seasons.map((season) => ({ value: String(season), label: String(season) }))}
        selected={String(activeSeason)}
        onSelect={(value) => router.push(`/tournaments/${segmentKey}?year=${value}`)}
        triggerClassName="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[14px] transition-colors hover:border-[var(--ui-ink)] sm:text-[14px]"
      />
    </div>
  );
}
