"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SEASON_2026_SEGMENTS, type SeasonSegmentKey } from "@/lib/tournaments/season-2026";

export function SeasonSegmentFilter({
  activeSegment,
  basePath,
  preserveKeys = [],
}: {
  activeSegment: SeasonSegmentKey | "all";
  basePath: string;
  preserveKeys?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {SEASON_2026_SEGMENTS.map((segment) => (
          <button
            key={segment.key}
            type="button"
            title={segment.description}
            onClick={() => navigate(segment.key)}
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              activeSegment === segment.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {segment.label}
          </button>
        ))}
      </div>
    </div>
  );
}
