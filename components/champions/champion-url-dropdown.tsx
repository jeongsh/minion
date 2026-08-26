"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { FilterDropdown, type FilterOption } from "@/components/match-filter-dropdown";

export function ChampionUrlDropdown({
  ariaLabel,
  options,
  selected,
  paramName,
  preserve,
  resetKeys = [],
  omitValues = ["all"],
  triggerClassName = "",
}: {
  ariaLabel: string;
  options: FilterOption[];
  selected: string;
  paramName: string;
  preserve?: Record<string, string | undefined>;
  resetKeys?: string[];
  omitValues?: string[];
  triggerClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function select(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, preservedValue] of Object.entries(preserve ?? {})) {
      if (!next.has(key) && preservedValue) next.set(key, preservedValue);
    }
    for (const key of resetKeys) next.delete(key);
    if (omitValues.includes(value)) next.delete(paramName);
    else next.set(paramName, value);

    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <FilterDropdown
      ariaLabel={ariaLabel}
      options={options}
      selected={selected}
      onSelect={select}
      triggerClassName={`${triggerClassName} !text-[13px] sm:!text-[14px]`}
    />
  );
}
