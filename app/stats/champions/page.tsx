import { Suspense } from "react";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getChampions, getMatches, getSetPicksBans, getSets, getTeams, getTournaments } from "@/lib/data/lck";
import {
  filterMatchesBySegment,
  filterPicksBansByMatches,
  filterSetsByMatches,
  parseSeasonSegment,
  segmentLabel,
} from "@/lib/tournament-filters";
import { teamLabel } from "@/lib/view-data";

export default async function ChampionStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);

  const [champions, picksBans, teams, matches, sets, tournaments] = await Promise.all([
    getChampions(),
    getSetPicksBans(),
    getTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
  ]);

  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const segmentSets = filterSetsByMatches(sets, segmentMatches);
  const scopedPicksBans = filterPicksBansByMatches(picksBans, segmentSets, segmentMatches);

  const rows = champions.map((champion) => {
    const picks = scopedPicksBans.filter(
      (item) => item.championId === champion.id && item.actionType === "pick",
    );
    const bans = scopedPicksBans.filter(
      (item) => item.championId === champion.id && item.actionType === "ban",
    );
    const usedTeams =
      [...new Set(picks.map((item) => item.teamId))]
        .map((teamId) => teamLabel(teams, teamId))
        .filter((label) => label !== "-")
        .join(", ") || "-";

    return {
      champion,
      picks: picks.length,
      bans: bans.length,
      pickBanCount: picks.length + bans.length,
      teams: usedTeams,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title={`${segmentLabel(activeSegment)} 챔피언 / 밴픽 스탯`} />

      <Suspense fallback={null}>
        <SeasonSegmentFilter activeSegment={activeSegment} basePath="/stats/champions" />
      </Suspense>

      <DataTable
        rows={rows}
        columns={[
          { key: "name", label: "챔피언", render: (row) => row.champion.name },
          { key: "picked", label: "픽", render: (row) => row.picks },
          { key: "banned", label: "밴", render: (row) => row.bans },
          { key: "total", label: "밴픽 합계", render: (row) => row.pickBanCount },
          { key: "teams", label: "사용 팀", render: (row) => row.teams },
        ]}
      />
    </main>
  );
}
