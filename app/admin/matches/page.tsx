import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getStages, getTeams, getTournaments } from "@/lib/data/lck";
import type { Team } from "@/lib/types";
import { formatDateTime } from "@/lib/view-data";

import { createMatchAction } from "./actions";
import { MatchEditModal } from "./match-edit-modal";
import { MatchFields } from "./match-fields";

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.shortName ?? "-";
}

export default async function AdminMatchesPage() {
  const [matches, teams, tournaments, stages, players] = await Promise.all([
    getMatches(),
    getTeams(),
    getTournaments(),
    getStages(),
    getPlayers(),
  ]);

  const sortedMatches = [...matches].sort(
    (a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime(),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="경기 관리" />

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
        <h2 className="text-lg font-semibold">경기 목록</h2>
        <DataTable
          rows={sortedMatches}
          columns={[
            { key: "name", label: "경기", render: (row) => row.name },
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
            { key: "venue", label: "경기장", render: (row) => row.venue ?? "-" },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <MatchEditModal
                  match={row}
                  teams={teams}
                  tournaments={tournaments}
                  stages={stages}
                  players={players}
                />
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}
