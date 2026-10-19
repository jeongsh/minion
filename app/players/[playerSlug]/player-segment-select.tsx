"use client";
import { FilterDropdown } from "@/components/match-filter-dropdown";

export function PlayerSegmentSelect({
  activeSegment,
  options,
}: {
  activeSegment: string;
  options: Array<{ href: string; label: string; value: string }>;
}) {
  return <div className="md:hidden"><FilterDropdown ariaLabel="대회 구간" selected={activeSegment} options={options} onSelect={value=>{
    const next=options.find(option=>option.value===value);
    if(next) window.location.assign(next.href);
  }} triggerClassName="w-full" /></div>;
}
