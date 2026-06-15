import Link from "next/link";
import { Suspense } from "react";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getTeams, getTournaments } from "@/lib/data/lck";
import { filterMatchesBySegment, parseSeasonSegment, segmentLabel } from "@/lib/tournament-filters";
import { teamLabel } from "@/lib/view-data";

export default async function PomPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);

  const [matches, players, teams, tournaments] = await Promise.all([
    getMatches(),
    getPlayers(),
    getTeams(),
    getTournaments(),
  ]);

  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);

  const rows = players
    .map((player) => ({
      player,
      officialPomCount: segmentMatches.filter((match) => match.officialPomPlayerId === player.id).length,
    }))
    .filter((row) => row.officialPomCount > 0)
    .sort((a, b) => b.officialPomCount - a.officialPomCount);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="스탯" title={`${segmentLabel(activeSegment)} 공식 POM 랭킹`} />

      <Suspense fallback={null}>
        <SeasonSegmentFilter activeSegment={activeSegment} basePath="/stats/pom" />
      </Suspense>

      <DataTable
        rows={rows}
        emptyText="공식 POM 데이터가 아직 없습니다."
        columns={[
          { key: "rank", label: "순위", render: (row) => rows.indexOf(row) + 1 },
          {
            key: "player",
            label: "선수",
            render: (row) => <Link href={`/players/${row.player.slug}`}>{row.player.name}</Link>,
          },
          { key: "team", label: "팀", render: (row) => teamLabel(teams, row.player.teamId) },
          { key: "position", label: "포지션", render: (row) => row.player.position },
          { key: "pom", label: "공식 POM 횟수", render: (row) => row.officialPomCount },
        ]}
      />
    </main>
  );
}
