import { Suspense } from "react";
import Link from "next/link";

import { SeasonSegmentFilter } from "@/components/domain/season-segment-filter";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getStages, getTeams, getTournaments } from "@/lib/data/lck";
import {
  filterMatchesBySegment,
  parseSeasonSegment,
  segmentLabel,
} from "@/lib/tournament-filters";
import type { Team } from "@/lib/types";
import { formatDateTime, matchHref, matchRouteId } from "@/lib/view-data";

import { createMatchAction, getLeaguepediaSyncCursor } from "./actions";
import { MatchFields } from "./match-fields";
import { SyncLeaguepediaButton } from "./sync-leaguepedia-button";

export const maxDuration = 120;

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.shortName ?? "-";
}

function tournamentName(
  tournaments: Awaited<ReturnType<typeof getTournaments>>,
  tournamentId: string,
) {
  return tournaments.find((tournament) => tournament.id === tournamentId)?.name ?? "-";
}

export default async function AdminMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const params = await searchParams;
  const activeSegment = parseSeasonSegment(params.segment);

  const [matches, teams, tournaments, stages, players, syncCursor] = await Promise.all([
    getMatches(),
    getTeams(),
    getTournaments(),
    getStages(),
    getPlayers(),
    getLeaguepediaSyncCursor(),
  ]);

  const segmentMatches = filterMatchesBySegment(matches, tournaments, activeSegment);
  const sortedMatches = [...segmentMatches].sort(
    (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="경기 관리" />

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">Leaguepedia 동기화</h2>
        <div className="mt-4">
          <SyncLeaguepediaButton cursor={syncCursor} />
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">경기 생성</h2>
        <form action={createMatchAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MatchFields teams={teams} tournaments={tournaments} stages={stages} players={players} />
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              경기 생성
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {segmentLabel(activeSegment)} 경기 목록 ({sortedMatches.length}건)
          </h2>
          <Suspense fallback={null}>
            <SeasonSegmentFilter activeSegment={activeSegment} basePath="/admin/matches" />
          </Suspense>
        </div>
        <DataTable
          rows={sortedMatches}
          emptyText={`${segmentLabel(activeSegment)} 구간에 등록된 경기가 없습니다.`}
          columns={[
            { key: "name", label: "경기", render: (row) => row.name },
            {
              key: "tournament",
              label: "대회",
              render: (row) => tournamentName(tournaments, row.tournamentId),
            },
            { key: "date", label: "일시", render: (row) => formatDateTime(row.matchDate) },
            {
              key: "teams",
              label: "팀",
              render: (row) => `${teamName(teams, row.teamAId)} vs ${teamName(teams, row.teamBId)}`,
            },
            {
              key: "score",
              label: "스코어",
              render: (row) => `${row.teamAScore ?? "-"} : ${row.teamBScore ?? "-"}`,
            },
            { key: "status", label: "상태", render: (row) => row.status },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Link
                    href={matchHref(row)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-muted"
                  >
                    상세
                  </Link>
                  <Link
                    href={`/admin/matches/${matchRouteId(row)}/edit`}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-muted"
                  >
                    수정
                  </Link>
                </div>
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}
