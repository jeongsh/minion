"use client";

import { FilterDropdown, type FilterOption } from "@/components/match-filter-dropdown";

export function EventFilterField({ label, selected, options, onSelect, disabled, variant = "list" }: {
  label: string;
  selected: string;
  options: FilterOption[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  variant?: "list" | "grid";
}) {
  return (
    <FilterDropdown
      ariaLabel={`${label} 선택`}
      appearance="plain"
      selected={selected}
      options={options}
      onSelect={onSelect}
      disabled={disabled}
      variant={variant}
      rootClassName="max-w-full"
      triggerClassName="min-h-11 max-w-full gap-2 rounded-lg bg-[var(--ui-card-bg)] px-3 text-sm font-medium transition-colors hover:bg-[var(--ui-card-hover)] aria-expanded:ring-1 aria-expanded:ring-[var(--accent)] [&>svg]:shrink-0"
    />
  );
}
