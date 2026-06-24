"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { ChampionRankingMode } from "@/lib/champion-rankings";
import type { PlayerPosition } from "@/lib/types";

export type StandingsView = "teams" | "players" | "champions";
export type StandingsPosition = PlayerPosition | "all";

type CompetitionOption = {
  id: string;
  name: string;
};

const viewOptions: Array<{ id: StandingsView; label: string }> = [
  { id: "teams", label: "팀" },
  { id: "players", label: "선수" },
  { id: "champions", label: "챔피언" },
];

const positionOptions: Array<{ id: StandingsPosition; label: string }> = [
  { id: "all", label: "전체" },
  { id: "TOP", label: "TOP" },
  { id: "JGL", label: "JGL" },
  { id: "MID", label: "MID" },
  { id: "BOT", label: "BOT" },
  { id: "SUP", label: "SUP" },
];

const championRankOptions: Array<{ id: ChampionRankingMode; label: string }> = [
  { id: "combined", label: "밴픽 합계 순위" },
  { id: "ban", label: "밴" },
  { id: "pick", label: "픽" },
];

export function StandingsFilter({
  seasons,
  competitions,
  activeSeason,
  activeCompetitionId,
  activeView,
  activePosition,
  activeChampionRankMode,
}: {
  seasons: number[];
  competitions: CompetitionOption[];
  activeSeason: number;
  activeCompetitionId: string;
  activeView: StandingsView;
  activePosition: StandingsPosition;
  activeChampionRankMode: ChampionRankingMode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSecondaryFilter = activeView === "players" || activeView === "champions";

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const query = params.toString();
    router.push(query ? `/standings?${query}` : "/standings", { scroll: false });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className={showSecondaryFilter ? "grid lg:grid-cols-4" : "grid md:grid-cols-3"}>
        <label className="border-b border-border p-5 md:border-r lg:border-b-0">
          <span className="block text-xs font-semibold text-accent">년도</span>
          <select
            value={activeSeason}
            onChange={(event) =>
              navigate({
                year: event.target.value,
                season: null,
                tournament: null,
                position: null,
                championRank: null,
              })
            }
            className="mt-2 w-full bg-transparent text-lg font-bold text-foreground outline-none"
          >
            {seasons.map((season) => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </label>

        <label className="border-b border-border p-5 md:border-r lg:border-b-0">
          <span className="block text-xs font-semibold text-accent">대회</span>
          <select
            value={activeCompetitionId}
            disabled={competitions.length === 0}
            onChange={(event) => navigate({ tournament: event.target.value, position: null })}
            className="mt-2 w-full bg-transparent text-lg font-bold text-foreground outline-none disabled:text-muted"
          >
            {competitions.length === 0 ? (
              <option value="">대회 없음</option>
            ) : (
              competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="border-b border-border p-5 md:border-b-0 md:border-r">
          <span className="block text-xs font-semibold text-accent">유형</span>
          <select
            value={activeView}
            onChange={(event) => {
              const nextView = event.target.value as StandingsView;

              navigate({
                view: nextView === "teams" ? null : nextView,
                position: nextView === "players" ? "all" : null,
                championRank: null,
              });
            }}
            className="mt-2 w-full bg-transparent text-lg font-bold text-foreground outline-none"
          >
            {viewOptions.map((view) => (
              <option key={view.id} value={view.id}>
                {view.label}
              </option>
            ))}
          </select>
        </label>

        {activeView === "players" ? (
          <label className="p-5">
            <span className="block text-xs font-semibold text-accent">포지션</span>
            <select
              value={activePosition}
              onChange={(event) =>
                navigate({ position: event.target.value === "all" ? null : event.target.value })
              }
              className="mt-2 w-full bg-transparent text-lg font-bold text-foreground outline-none"
            >
              {positionOptions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {activeView === "champions" ? (
          <label className="p-5">
            <span className="block text-xs font-semibold text-accent">순위</span>
            <select
              value={activeChampionRankMode}
              onChange={(event) =>
                navigate({
                  championRank:
                    event.target.value === "combined" ? null : event.target.value,
                })
              }
              className="mt-2 w-full bg-transparent text-lg font-bold text-foreground outline-none"
            >
              {championRankOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </section>
  );
}
