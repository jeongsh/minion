import Link from "next/link";
import { Suspense } from "react";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getSets, getTeams, getTournaments } from "@/lib/data/lck";
import {
  filterMatchesBySegment,
  filterSetsByMatches,
  parseSeasonSegment,
  segmentLabel,
} from "@/lib/tournament-filters";
import { buildTeamStandingRows, buildTeamStatSummary } from "@/lib/view-data";

export default async function TeamStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);

  const [teams, matches, sets, tournaments] = await Promise.all([
    getTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
  ]);

  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const segmentSets = filterSetsByMatches(sets, segmentMatches);
  const rows = buildTeamStandingRows(teams, segmentMatches, segmentSets).map((standing) => ({
    ...standing,
    stats: buildTeamStatSummary(standing.team.id, segmentSets),
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title={`${segmentLabel(activeSegment)} 팀 스탯`} />

      <Suspense fallback={null}>
        <SeasonSegmentFilter activeSegment={activeSegment} basePath="/stats/teams" />
      </Suspense>

      <DataTable
        rows={rows}
        columns={[
          {
            key: "team",
            label: "팀명",
            render: (row) => <Link href={`/teams/${row.team.slug}`}>{row.team.name}</Link>,
          },
          { key: "win", label: "승률", render: (row) => row.winRate },
          { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
          { key: "set", label: "세트 전적", render: (row) => row.setRecord },
          { key: "kills", label: "평균 킬", render: (row) => row.stats.avgKills.toFixed(1) },
          { key: "deaths", label: "평균 데스", render: (row) => row.stats.avgDeaths.toFixed(1) },
          { key: "gold", label: "평균 골드", render: (row) => row.stats.avgGold.toLocaleString("ko-KR") },
          { key: "tower", label: "평균 타워", render: (row) => row.stats.avgTowers },
        ]}
      />
    </main>
  );
}
