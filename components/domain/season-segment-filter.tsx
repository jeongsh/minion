"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { useNavigationTransition } from "@/components/navigation/navigation-transition-provider";
import {
  DEFAULT_SEASON_YEAR,
  SEASON_2026_SEGMENTS,
  type SeasonSegmentKey,
} from "@/lib/tournaments/season-2026";

export function SeasonSegmentFilter({
  activeSegment,
  basePath,
  preserveKeys = [],
  seasonYear = DEFAULT_SEASON_YEAR,
}: {
  activeSegment: SeasonSegmentKey | "all";
  basePath: string;
  preserveKeys?: string[];
  seasonYear?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isNavigating, startNavigation } = useNavigationTransition();

  function navigate(segment: SeasonSegmentKey | "all") {
    const params = new URLSearchParams(searchParams.toString());

    for (const key of preserveKeys) {
      const value = searchParams.get(key);
      if (value) {
        params.set(key, value);
      }
    }

    if (segment === "all") {
      params.delete("segment");
    } else {
      params.set("segment", segment);
    }

    const query = params.toString();
    const href = query ? `${basePath}?${query}` : basePath;
    if (startNavigation(href)) {
      router.push(href, { scroll: false });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SEASON_2026_SEGMENTS.map((segment) => (
          <button
            key={segment.key}
            type="button"
            disabled={isNavigating}
            title={segment.key === "all" ? `${seasonYear} 시즌 전체 경기` : segment.description}
            onClick={() => navigate(segment.key)}
            className={`rounded-md border px-3 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${
              activeSegment === segment.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
          >
            {segment.key === "all" ? `${seasonYear} 전체` : segment.label}
          </button>
        ))}
      </div>
    </div>
  );
}
