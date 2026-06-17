import Link from "next/link";

import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getAllTeams, getMatches, getSets } from "@/lib/data/lck";
import type { Match, Team } from "@/lib/types";
import { matchRouteId } from "@/lib/view-data";

import { createSetAction } from "./actions";
import { SetFields } from "./set-fields";

function teamName(teams: Team[], teamId: string | null | undefined) {
  return teams.find((team) => team.id === teamId)?.shortName ?? "-";
}

function matchName(matches: Match[], matchId: string) {
  return matches.find((match) => match.id === matchId)?.name ?? matchId;
}

function matchAdminPath(matches: Match[], matchId: string) {
  const match = matches.find((item) => item.id === matchId);
  return match ? `/admin/matches/${matchRouteId(match)}/edit` : "/admin/matches";
}

export default async function AdminSetsPage() {
  const [sets, matches, teams] = await Promise.all([getSets(), getMatches(), getAllTeams()]);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="세트 관리" />

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold">세트 생성</h2>
        <form action={createSetAction} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SetFields matches={matches} teams={teams} />
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              세트 생성
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">세트 목록</h2>
        <DataTable
          rows={sets}
          columns={[
            { key: "match", label: "경기", render: (row) => matchName(matches, row.matchId) },
            { key: "set", label: "세트", render: (row) => `${row.setNumber}세트` },
            { key: "winner", label: "승리 팀", render: (row) => teamName(teams, row.winnerTeamId) },
            { key: "side", label: "진영", render: (row) => `${teamName(teams, row.blueTeamId)} / ${teamName(teams, row.redTeamId)}` },
            { key: "kills", label: "킬", render: (row) => `${row.blueKills ?? "-"} : ${row.redKills ?? "-"}` },
            { key: "gold", label: "골드", render: (row) => `${row.blueGold ?? "-"} : ${row.redGold ?? "-"}` },
            {
              key: "actions",
              label: "",
              render: (row) => (
                <Link
                  href={`${matchAdminPath(matches, row.matchId)}/sets/${row.id}/edit`}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-semibold hover:bg-surface-muted"
                >
                  수정
                </Link>
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}
