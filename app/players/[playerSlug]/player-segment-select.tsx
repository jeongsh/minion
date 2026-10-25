"use client";
import { FilterDropdown } from "@/components/match-filter-dropdown";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlayerSegmentSelect({
  activeSegment,
  options,
}: {
  activeSegment: string;
  options: Array<{ href: string; label: string; value: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(activeSegment);
  const [serverSegment, setServerSegment] = useState(activeSegment);
  if (serverSegment !== activeSegment) {
    setServerSegment(activeSegment);
    setSelected(activeSegment);
  }
  return <div className="md:hidden"><FilterDropdown ariaLabel="대회 구간" selected={selected} options={options} onSelect={value=>{
    const next=options.find(option=>option.value===value);
    if(next) { setSelected(value); router.push(next.href, { scroll: false }); }
  }} triggerClassName="w-full" /></div>;
}
