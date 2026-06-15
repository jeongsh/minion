import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getMatches, getSets, getTeams } from "@/lib/data/lck";
import type { Match, SetResult, Team } from "@/lib/types";

import { createSetAction, updateSetAction } from "./actions";

function teamName(teams: Team[], teamId: string | null | undefined) {
  return teams.find((team) => team.id === teamId)?.shortName ?? "-";
}

function matchName(matches: Match[], matchId: string) {
  return matches.find((match) => match.id === matchId)?.name ?? matchId;
}

function numberValue(value: number | null | undefined) {
  return value ?? "";
}

function TeamSelect({
  name,
  label,
  teams,
  defaultValue,
}: {
  name: string;
  label: string;
  teams: Team[];
  defaultValue?: string | null;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
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
  );
}

function SetFields({
  set,
  matches,
  teams,
}: {
  set?: SetResult;
  matches: Match[];
  teams: Team[];
}) {
  return (
    <>
      {set ? <input type="hidden" name="setId" value={set.id} /> : null}
      <label className="flex flex-col gap-2 text-sm font-medium">
        경기
        <select
          name="matchId"
          defaultValue={set?.matchId ?? matches[0]?.id ?? ""}
          required
          className="rounded-md border border-border bg-background px-3 py-2"
        >
          <option value="">선택</option>
          {matches.map((match) => (
            <option key={match.id} value={match.id}>
              {match.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        세트 번호
        <input
          name="setNumber"
          type="number"
          min="1"
          required
          defaultValue={set?.setNumber ?? 1}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <TeamSelect name="winnerTeamId" label="승리 팀" teams={teams} defaultValue={set?.winnerTeamId} />
      <TeamSelect name="blueTeamId" label="블루 팀" teams={teams} defaultValue={set?.blueTeamId} />
      <TeamSelect name="redTeamId" label="레드 팀" teams={teams} defaultValue={set?.redTeamId} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        경기 시간(초)
        <input
          name="durationSeconds"
          type="number"
          min="0"
          defaultValue={numberValue(set?.durationSeconds)}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        블루 킬
        <input name="blueKills" type="number" min="0" defaultValue={numberValue(set?.blueKills)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        레드 킬
        <input name="redKills" type="number" min="0" defaultValue={numberValue(set?.redKills)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        블루 골드
        <input name="blueGold" type="number" min="0" defaultValue={numberValue(set?.blueGold)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        레드 골드
        <input name="redGold" type="number" min="0" defaultValue={numberValue(set?.redGold)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        블루 용
        <input name="blueDragons" type="number" min="0" defaultValue={numberValue(set?.blueDragons)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        레드 용
        <input name="redDragons" type="number" min="0" defaultValue={numberValue(set?.redDragons)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        블루 바론
        <input name="blueBarons" type="number" min="0" defaultValue={numberValue(set?.blueBarons)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        레드 바론
        <input name="redBarons" type="number" min="0" defaultValue={numberValue(set?.redBarons)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        블루 타워
        <input name="blueTowers" type="number" min="0" defaultValue={numberValue(set?.blueTowers)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        레드 타워
        <input name="redTowers" type="number" min="0" defaultValue={numberValue(set?.redTowers)} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        패치
        <input name="patch" defaultValue={set?.patch ?? ""} placeholder="26.10" className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Leaguepedia Game ID
        <input name="leaguepediaGameId" defaultValue={set?.leaguepediaGameId ?? ""} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Riot Match ID
        <input name="riotMatchId" defaultValue={set?.riotMatchId ?? ""} placeholder="KR_1234567890" className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Riot Platform Game ID
        <input name="riotPlatformGameId" defaultValue={set?.riotPlatformGameId ?? ""} className="rounded-md border border-border bg-background px-3 py-2" />
      </label>
    </>
  );
}

export default async function AdminSetsPage() {
  const [sets, matches, teams] = await Promise.all([getSets(), getMatches(), getTeams()]);

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
            { key: "winner", label: "승리팀", render: (row) => teamName(teams, row.winnerTeamId) },
            { key: "side", label: "진영", render: (row) => `${teamName(teams, row.blueTeamId)} / ${teamName(teams, row.redTeamId)}` },
            { key: "kills", label: "킬", render: (row) => `${row.blueKills ?? "-"}:${row.redKills ?? "-"}` },
            { key: "gold", label: "골드", render: (row) => `${row.blueGold ?? "-"}:${row.redGold ?? "-"}` },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">세트 수정</h2>
        <div className="grid gap-4">
          {sets.map((set) => (
            <form key={set.id} action={updateSetAction} className="rounded-md border border-border bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{set.id}</p>
                  <h3 className="font-semibold">
                    {matchName(matches, set.matchId)} · {set.setNumber}세트
                  </h3>
                </div>
                <button type="submit" className="rounded-md border border-border px-4 py-2 text-sm font-semibold">
                  수정 저장
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <SetFields set={set} matches={matches} teams={teams} />
              </div>
            </form>
          ))}
        </div>
      </section>
    </main>
  );
}
