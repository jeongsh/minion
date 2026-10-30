"use client";

import { useRouter } from "next/navigation";
import { FilterDropdown, type FilterOption } from "@/components/match-filter-dropdown";

export function MatchSetSelect({
  options,
  selected,
  tab,
}: {
  options: FilterOption[];
  selected: string;
  tab: "data" | "rating";
}) {
  const router = useRouter();

  return (
    <FilterDropdown
      ariaLabel="세트 선택"
      matchTriggerWidth
      triggerClassName="!bg-[var(--ui-card-bg)]"
      options={options}
      selected={selected}
      onSelect={(set) => {
        if (set === selected) return;
        router.push(`?${new URLSearchParams({ tab, set })}`, { scroll: false });
      }}
    />
  );
}
