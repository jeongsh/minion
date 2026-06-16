import type { Match, SetResult, Team } from "@/lib/types";

function numberValue(value: number | null | undefined) {
  return value ?? "";
}

function NumberField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        name={name}
        type="number"
        min="0"
        defaultValue={numberValue(defaultValue)}
        className="rounded-md border border-border bg-background px-3 py-2"
      />
    </label>
  );
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

export function SetFields({
  set,
  matches,
  teams,
  lockedMatchId,
}: {
  set?: SetResult;
  matches: Match[];
  teams: Team[];
  lockedMatchId?: string;
}) {
  const defaultMatchId = lockedMatchId ?? set?.matchId ?? matches[0]?.id ?? "";

  return (
    <>
      {set ? <input type="hidden" name="setId" value={set.id} /> : null}
      {lockedMatchId ? (
        <input type="hidden" name="matchId" value={lockedMatchId} />
      ) : (
        <label className="flex flex-col gap-2 text-sm font-medium">
          경기
          <select
            name="matchId"
            defaultValue={defaultMatchId}
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
      )}
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
      <NumberField name="durationSeconds" label="경기 시간(초)" defaultValue={set?.durationSeconds} />
      <NumberField name="blueKills" label="블루 킬" defaultValue={set?.blueKills} />
      <NumberField name="redKills" label="레드 킬" defaultValue={set?.redKills} />
      <NumberField name="blueGold" label="블루 골드" defaultValue={set?.blueGold} />
      <NumberField name="redGold" label="레드 골드" defaultValue={set?.redGold} />
      <NumberField name="blueDragons" label="블루 드래곤" defaultValue={set?.blueDragons} />
      <NumberField name="redDragons" label="레드 드래곤" defaultValue={set?.redDragons} />
      <NumberField name="blueClouds" label="블루 바람용" defaultValue={set?.blueClouds} />
      <NumberField name="redClouds" label="레드 바람용" defaultValue={set?.redClouds} />
      <NumberField name="blueInfernals" label="블루 화염용" defaultValue={set?.blueInfernals} />
      <NumberField name="redInfernals" label="레드 화염용" defaultValue={set?.redInfernals} />
      <NumberField name="blueMountains" label="블루 대지용" defaultValue={set?.blueMountains} />
      <NumberField name="redMountains" label="레드 대지용" defaultValue={set?.redMountains} />
      <NumberField name="blueOceans" label="블루 바다용" defaultValue={set?.blueOceans} />
      <NumberField name="redOceans" label="레드 바다용" defaultValue={set?.redOceans} />
      <NumberField name="blueHextechs" label="블루 마공용" defaultValue={set?.blueHextechs} />
      <NumberField name="redHextechs" label="레드 마공용" defaultValue={set?.redHextechs} />
      <NumberField name="blueChemtechs" label="블루 화공용" defaultValue={set?.blueChemtechs} />
      <NumberField name="redChemtechs" label="레드 화공용" defaultValue={set?.redChemtechs} />
      <NumberField name="blueElders" label="블루 장로" defaultValue={set?.blueElders} />
      <NumberField name="redElders" label="레드 장로" defaultValue={set?.redElders} />
      <NumberField name="blueBarons" label="블루 바론" defaultValue={set?.blueBarons} />
      <NumberField name="redBarons" label="레드 바론" defaultValue={set?.redBarons} />
      <NumberField name="blueTowers" label="블루 타워" defaultValue={set?.blueTowers} />
      <NumberField name="redTowers" label="레드 타워" defaultValue={set?.redTowers} />
      <label className="flex flex-col gap-2 text-sm font-medium">
        패치
        <input
          name="patch"
          defaultValue={set?.patch ?? ""}
          placeholder="26.10"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Leaguepedia Game ID
        <input
          name="leaguepediaGameId"
          defaultValue={set?.leaguepediaGameId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Riot Match ID
        <input
          name="riotMatchId"
          defaultValue={set?.riotMatchId ?? ""}
          placeholder="KR_1234567890"
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-medium">
        Riot Platform Game ID
        <input
          name="riotPlatformGameId"
          defaultValue={set?.riotPlatformGameId ?? ""}
          className="rounded-md border border-border bg-background px-3 py-2"
        />
      </label>
    </>
  );
}
