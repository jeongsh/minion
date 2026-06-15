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
import { buildTeamStandingRows, formatDateTime, teamLabel } from "@/lib/view-data";

export default async function StandingsPage({
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
  const standings = buildTeamStandingRows(teams, segmentMatches, segmentSets);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="순위" title={`${segmentLabel(activeSegment)} 팀 순위표`} />

      <Suspense fallback={null}>
        <SeasonSegmentFilter activeSegment={activeSegment} basePath="/standings" />
      </Suspense>

      <DataTable
        rows={standings}
        columns={[
          { key: "rank", label: "순위", render: (row) => row.rank },
          {
            key: "team",
            label: "팀명",
            render: (row) => <Link href={`/teams/${row.team.slug}`}>{row.team.name}</Link>,
          },
          { key: "shortName", label: "약칭", render: (row) => row.team.shortName },
          { key: "match", label: "매치 전적", render: (row) => row.matchRecord },
          { key: "set", label: "세트 전적", render: (row) => row.setRecord },
          { key: "rate", label: "승률", render: (row) => row.winRate },
          { key: "diff", label: "세트 득실", render: (row) => row.setDiff },
          { key: "recent", label: "최근 5경기", render: (row) => row.recent },
          {
            key: "next",
            label: "다음 경기",
            render: (row) =>
              row.nextMatch
                ? `${formatDateTime(row.nextMatch.matchDate)} · ${teamLabel(teams, row.nextMatch.teamAId)} vs ${teamLabel(teams, row.nextMatch.teamBId)}`
                : "-",
          },
        ]}
      />
    </main>
  );
}
