import Link from "next/link";
import { notFound } from "next/navigation";

import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import {
  getMatchById,
  getPlayers,
  getSetsByMatchId,
  getStages,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import { durationLabel, matchHref, matchRouteId, teamLabel } from "@/lib/view-data";

import { updateMatchAction } from "../../actions";
import { MatchFields } from "../../match-fields";
import { SyncMatchSetsButton } from "./sync-match-sets-button";
import { SyncRiotItemsButton } from "./sync-riot-items-button";

export default async function AdminMatchEditPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);

  if (!match) {
    notFound();
  }

  const [teams, players, tournaments, stages, sets] = await Promise.all([
    getTeams(),
    getPlayers(),
    getTournaments(),
    getStages(),
    getSetsByMatchId(match.id),
  ]);

  const adminMatchPath = `/admin/matches/${matchRouteId(match)}/edit`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeader eyebrow="경기 관리" title={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)}`} />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/matches"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            목록
          </Link>
          <Link
            href={matchHref(match)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted"
          >
            공개 상세
          </Link>
        </div>
      </div>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">경기 수정</h2>
        <form action={updateMatchAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <input type="hidden" name="redirectTo" value={adminMatchPath} />
          <MatchFields
            match={match}
            teams={teams}
            tournaments={tournaments}
            stages={stages}
            players={players}
          />
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              경기 저장
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">세트 결과 ({sets.length}개)</h2>
          <div className="flex flex-wrap items-start gap-2">
            <SyncMatchSetsButton matchId={match.id} />
            <SyncRiotItemsButton matchId={match.id} />
            <Link
              href={`${adminMatchPath}/sets/new`}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              세트 추가
            </Link>
          </div>
        </div>
        <DataTable
          rows={sets}
          emptyText="아직 등록된 세트 결과가 없습니다."
          columns={[
            { key: "set", label: "세트", render: (row) => `${row.setNumber}세트` },
            { key: "winner", label: "승리 팀", render: (row) => teamLabel(teams, row.winnerTeamId) },
            { key: "side", label: "진영", render: (row) => `${teamLabel(teams, row.blueTeamId)} / ${teamLabel(teams, row.redTeamId)}` },
            { key: "time", label: "경기 시간", render: (row) => durationLabel(row.durationSeconds) },
            { key: "kills", label: "킬", render: (row) => `${row.blueKills ?? "-"} : ${row.redKills ?? "-"}` },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Link
                    href={`${adminMatchPath}/sets/${row.id}/edit`}
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
