"use client";

import { useEffect } from "react";

import { useSpoilerFree } from "@/lib/spoiler-free/spoiler-free-context";

/** Record actual detail visits, including direct links, without recording prefetches. */
export function MatchResultSeen({ matchId, finished }: { matchId: string; finished: boolean }) {
  const { reveal } = useSpoilerFree();

  useEffect(() => {
    if (finished) reveal(matchId);
  }, [finished, matchId, reveal]);

  return null;
}
