import type { Match, Player, Stage, Team, Tournament } from "@/lib/types";
import { formatDateTimeLocalKST } from "@/lib/view-data";

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
        VOD URL
        <input
          name="vodUrl"
          defaultValue={match?.vodUrl ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </label>
    </>
  );
}

export function MatchFields({
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
        경기 일시 <span className="text-xs font-normal text-muted">(한국 시간 KST 기준)</span>
        <input
          name="matchDate"
          type="datetime-local"
          defaultValue={match ? formatDateTimeLocalKST(match.matchDate) : ""}
          required
          className="rounded-md border border-border bg-background px-3 py-2"
        />
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
        Leaguepedia Match ID
        <input
          name="leaguepediaMatchId"
          defaultValue={match?.leaguepediaMatchId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="Leaguepedia Match ID"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        LoL Esports Match ID
        <input
          name="lolesportsMatchId"
          defaultValue={match?.lolesportsMatchId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
          placeholder="lolesports.com match ID (자동 매칭 가능)"
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
    </>
  );
}
