import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getPlayers, getStages, getTeams, getTournaments } from "@/lib/data/lck";
import type { Match, Player, Stage, Team, Tournament } from "@/lib/types";

import { createMatchAction, updateMatchAction } from "./actions";

function formatDateTimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function teamName(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId)?.shortName ?? "-";
}

function SelectFields({
  teams,
  tournaments,
  stages,
  players,
  match,
}: {
  teams: Team[];
  tournaments: Tournament[];
  stages: Stage[];
  players: Player[];
  match?: Match;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm font-medium">
        대회
        <select
          name="tournamentId"
          defaultValue={match?.tournamentId ?? tournaments[0]?.id ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {tournaments.map((tournament) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        스테이지
        <select
          name="stageId"
          defaultValue={match?.stageId ?? stages[0]?.id ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        팀 A
        <select
          name="teamAId"
          defaultValue={match?.teamAId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.shortName} · {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        팀 B
        <select
          name="teamBId"
          defaultValue={match?.teamBId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.shortName} · {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        공식 POM
        <select
          name="officialPomPlayerId"
          defaultValue={match?.officialPomPlayerId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        승리 팀
        <select
          name="winnerTeamId"
          defaultValue={match?.winnerTeamId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택 안 함</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.shortName}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function MatchFields({
  match,
  teams,
  tournaments,
  stages,
  players,
}: {
  match?: Match;
  teams: Team[];
  tournaments: Tournament[];
  stages: Stage[];
  players: Player[];
}) {
  return (
    <>
      {match ? <input type="hidden" name="matchId" value={match.id} /> : null}
      <label className="flex flex-col gap-2 text-sm font-medium">
        경기명
        <input
          name="name"
          defaultValue={match?.name ?? ""}
          required
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="T1 vs Gen.G"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        경기 일시
        <input
          name="matchDate"
          type="datetime-local"
          defaultValue={match ? formatDateTimeLocal(match.matchDate) : ""}
          required
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        상태
        <select
          name="status"
          defaultValue={match?.status ?? "scheduled"}
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="scheduled">scheduled</option>
          <option value="live">live</option>
          <option value="completed">completed</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Best of
        <input
          name="bestOf"
          type="number"
          min="1"
          defaultValue={match?.bestOf ?? 3}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <SelectFields teams={teams} tournaments={tournaments} stages={stages} players={players} match={match} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        팀 A 스코어
        <input
          name="teamAScore"
          type="number"
          min="0"
          defaultValue={match?.teamAScore ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        팀 B 스코어
        <input
          name="teamBScore"
          type="number"
          min="0"
          defaultValue={match?.teamBScore ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Leaguepedia Match ID
        <input
          name="leaguepediaMatchId"
          defaultValue={match?.leaguepediaMatchId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="Leaguepedia 내부 ID"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        경기장
        <input
          name="venue"
          defaultValue={match?.venue ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="예: LoL PARK"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        다시보기 URL
        <input
          name="vodUrl"
          defaultValue={match?.vodUrl ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="https://..."
        />
      </label>
    </>
  );
}

export default async function AdminMatchesPage() {
  const [matches, teams, tournaments, stages, players] = await Promise.all([
    getMatches(),
    getTeams(),
    getTournaments(),
    getStages(),
    getPlayers(),
  ]);

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
          rows={matches}
          columns={[
            { key: "name", label: "경기", render: (row) => row.name },
            { key: "date", label: "일시", render: (row) => new Date(row.matchDate).toLocaleString("ko-KR") },
            { key: "teams", label: "팀", render: (row) => `${teamName(teams, row.teamAId)} vs ${teamName(teams, row.teamBId)}` },
            { key: "score", label: "스코어", render: (row) => `${row.teamAScore ?? "-"} : ${row.teamBScore ?? "-"}` },
            { key: "status", label: "상태", render: (row) => row.status },
            { key: "venue", label: "경기장", render: (row) => row.venue ?? "-" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">경기 수정</h2>
        <div className="grid gap-4">
          {matches.map((match) => (
            <form key={match.id} action={updateMatchAction} className="rounded-md border border-border bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{match.id}</p>
                  <h3 className="font-semibold">{match.name}</h3>
                </div>
                <button
                  type="submit"
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
                >
                  수정 저장
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <MatchFields match={match} teams={teams} tournaments={tournaments} stages={stages} players={players} />
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
