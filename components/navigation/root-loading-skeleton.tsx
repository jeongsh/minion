"use client";

import { usePathname } from "next/navigation";

import { HomeLoadingSkeleton, NeutralLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export function RootLoadingSkeleton() {
  const pathname = usePathname();
  return pathname === "/" ? <HomeLoadingSkeleton /> : <NeutralLoadingSkeleton />;
}
