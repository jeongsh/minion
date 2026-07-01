import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnoseMatches, type DiagnosticMatchRow, type DiagnosticSetRow } from "./match-diagnostics.ts";

const TEAM_A = "team-a";
const TEAM_B = "team-b";

function baseMatch(overrides: Partial<DiagnosticMatchRow> = {}): DiagnosticMatchRow {
  return {
    id: "match-1",
    name: "T1 vs TL",
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    bestOf: 5,
    status: "scheduled",
    teamAScore: null,
    teamBScore: null,
    winnerTeamId: null,
    ...overrides,
  };
}

function baseSet(overrides: Partial<DiagnosticSetRow> = {}): DiagnosticSetRow {
  return {
    id: "set-1",
    matchId: "match-1",
    setNumber: 1,
    status: "scheduled",
    winnerTeamId: null,
    blueTeamId: TEAM_A,
    redTeamId: TEAM_B,
    durationSeconds: null,
    blueKills: null,
    redKills: null,
    ...overrides,
  };
}

test("T1 vs TL 사례: 세트 1개 finished인데 매치는 scheduled -> 불일치 1건, 1:0/live로 재계산", () => {
  const match = baseMatch({ status: "scheduled", teamAScore: null, teamBScore: null, winnerTeamId: null });
  const set = baseSet({ status: "finished", winnerTeamId: TEAM_A, durationSeconds: 1800 });

  const diagnosis = diagnoseMatches([match], [set], [], []);

  assert.equal(diagnosis.matchMismatches.length, 1);
  assert.equal(diagnosis.matchMismatches[0].after.score, "1:0");
  assert.equal(diagnosis.matchMismatches[0].after.status, "live");
  assert.equal(diagnosis.winnerButScheduled.length, 0);
  assert.equal(diagnosis.hasDataButEarlyStatus.length, 0);
});

test("승자는 있는데 세트 상태가 scheduled로 남아있으면 winnerButScheduled에 잡힌다", () => {
  const match = baseMatch();
  const set = baseSet({ status: "scheduled", winnerTeamId: TEAM_A });

  const diagnosis = diagnoseMatches([match], [set], [], []);

  assert.equal(diagnosis.winnerButScheduled.length, 1);
  assert.equal(diagnosis.hasDataButEarlyStatus.length, 1);
});

test("일치하는 데이터는 불일치로 잡히지 않는다(멱등)", () => {
  const match = baseMatch({ status: "completed", teamAScore: 3, teamBScore: 0, winnerTeamId: TEAM_A });
  const sets = [1, 2, 3].map((setNumber) =>
    baseSet({ id: `set-${setNumber}`, setNumber, status: "finished", winnerTeamId: TEAM_A, durationSeconds: 1800 }),
  );

  const diagnosis = diagnoseMatches([match], sets, [], []);

  assert.equal(diagnosis.matchMismatches.length, 0);
  assert.equal(diagnosis.setStatusMismatches.length, 0);
});

test("세트 승자가 매치 참가팀 밖이면 setWinnerOutsideParticipants에 잡힌다", () => {
  const match = baseMatch();
  const set = baseSet({ winnerTeamId: "someone-else", status: "finished" });

  const diagnosis = diagnoseMatches([match], [set], [], []);

  assert.equal(diagnosis.setWinnerOutsideParticipants.length, 1);
});

test("블루/레드 팀이 매치 참가팀 밖이면 setTeamOutsideMatch에 잡힌다", () => {
  const match = baseMatch();
  const set = baseSet({ blueTeamId: "outsider-team" });

  const diagnosis = diagnoseMatches([match], [set], [], []);

  assert.equal(diagnosis.setTeamOutsideMatch.length, 1);
});

test("같은 세트 번호가 중복되면 setNumberAnomalies에 잡힌다", () => {
  const match = baseMatch();
  const sets = [baseSet({ id: "set-1", setNumber: 1 }), baseSet({ id: "set-2", setNumber: 1 })];

  const diagnosis = diagnoseMatches([match], sets, [], []);

  assert.equal(diagnosis.setNumberAnomalies.length, 1);
});

test("best_of보다 큰 세트 번호는 setNumberAnomalies에 잡힌다", () => {
  const match = baseMatch({ bestOf: 3 });
  const set = baseSet({ setNumber: 4 });

  const diagnosis = diagnoseMatches([match], [set], [], []);

  assert.equal(diagnosis.setNumberAnomalies.length, 1);
});

test("선수 스탯이 1~9명만 있으면 incompletePlayerStats에 잡힌다", () => {
  const match = baseMatch();
  const set = baseSet();
  const playerStats = Array.from({ length: 6 }, (_, index) => ({
    setId: set.id,
    playerId: `player-${index}`,
    teamId: TEAM_A,
    position: "TOP",
  }));

  const diagnosis = diagnoseMatches([match], [set], [], playerStats);

  assert.equal(diagnosis.incompletePlayerStats.length, 1);
});

test("참가팀이 아직 정해지지 않은 매치는 재조정 대상에서 제외된다", () => {
  const match = baseMatch({ teamAId: null, teamBId: null });

  const diagnosis = diagnoseMatches([match], [], [], []);

  assert.equal(diagnosis.matchesSkippedNoTeams.length, 1);
  assert.equal(diagnosis.matchMismatches.length, 0);
});
