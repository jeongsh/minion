"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function StandingsFilter({
  seasons,
  activeSeason,
  activeView,
}: {
  seasons: number[];
  activeSeason: number;
  activeView: "teams" | "players";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`/standings?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 연도 탭 */}
      <div className="flex flex-wrap gap-2">
        {seasons.map((season) => (
          <button
            key={season}
            type="button"
            onClick={() => navigate({ season: String(season) })}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
              activeSeason === season
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {season}
          </button>
        ))}
      </div>

      {/* 팀 / 선수 뷰 토글 */}
      <div className="flex gap-1 self-start rounded-lg border border-border bg-surface p-1">
        {(["teams", "players"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => navigate({ view: view === "teams" ? null : view })}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeView === view
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            {view === "teams" ? "팀 순위" : "선수 POM"}
          </button>
        ))}
      </div>
    </div>
  );
}
