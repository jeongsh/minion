"use client";

import { usePathname } from "next/navigation";

import { AccountLoadingSkeleton } from "@/components/navigation/account-loading-skeleton";
import { HomeLoadingSkeleton, NeutralLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

import { TournamentPendingContent } from "@/components/navigation/tournament-content-cache";

export function RootLoadingSkeleton() {
  const pathname = usePathname();
  if (["/me", "/me/profile", "/me/settings"].includes(pathname)) return <AccountLoadingSkeleton />;
  if (pathname === "/tournaments" || pathname.startsWith("/tournaments/")) return <TournamentPendingContent />;
  return pathname === "/" ? <HomeLoadingSkeleton /> : <NeutralLoadingSkeleton />;
}
