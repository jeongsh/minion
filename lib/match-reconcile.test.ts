import assert from "node:assert/strict";
import { test } from "node:test";

import { computeMatchAggregate } from "./match-reconcile.ts";

const TEAM_A = "team-a";
const TEAM_B = "team-b";

function aggregate(bestOf: number | null, winners: Array<string | null>) {
  return computeMatchAggregate({
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    bestOf,
    setResults: winners.map((winnerTeamId) => ({ winnerTeamId })),
  });
}

test("Bo3, 세트 없음 -> 0:0, scheduled, 승자 없음", () => {
  const result = aggregate(3, []);
  assert.deepEqual(result, { teamAScore: 0, teamBScore: 0, status: "scheduled", winnerTeamId: null });
});

test("Bo3, A 1승 -> 1:0, live", () => {
  const result = aggregate(3, [TEAM_A]);
  assert.deepEqual(result, { teamAScore: 1, teamBScore: 0, status: "live", winnerTeamId: null });
});

test("Bo3, A 2승 -> 2:0, completed, A 승자", () => {
  const result = aggregate(3, [TEAM_A, TEAM_A]);
  assert.deepEqual(result, { teamAScore: 2, teamBScore: 0, status: "completed", winnerTeamId: TEAM_A });
});

test("Bo3, 1:1 -> live", () => {
  const result = aggregate(3, [TEAM_A, TEAM_B]);
  assert.equal(result.status, "live");
  assert.equal(result.winnerTeamId, null);
});

test("Bo5, 2:2 -> live", () => {
  const result = aggregate(5, [TEAM_A, TEAM_B, TEAM_A, TEAM_B]);
  assert.equal(result.status, "live");
  assert.equal(result.winnerTeamId, null);
});

test("Bo5, B 3승 -> completed, B 승자", () => {
  const result = aggregate(5, [TEAM_B, TEAM_A, TEAM_B, TEAM_A, TEAM_B]);
  assert.deepEqual(result, { teamAScore: 2, teamBScore: 3, status: "completed", winnerTeamId: TEAM_B });
});

test("완료 경기 결과 한 세트 제거 -> 상태/스코어/승자 하향 재계산", () => {
  const completed = aggregate(3, [TEAM_A, TEAM_A]);
  assert.equal(completed.status, "completed");

  const downgraded = aggregate(3, [TEAM_A]);
  assert.deepEqual(downgraded, { teamAScore: 1, teamBScore: 0, status: "live", winnerTeamId: null });
});

test("같은 입력으로 두 번 실행해도 결과 동일 (멱등)", () => {
  const input = {
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    bestOf: 5,
    setResults: [{ winnerTeamId: TEAM_A }, { winnerTeamId: TEAM_B }, { winnerTeamId: TEAM_A }],
  };
  assert.deepEqual(computeMatchAggregate(input), computeMatchAggregate(input));
});

test("bestOf가 없으면 승자 다수여도 completed로 확정하지 않는다", () => {
  const result = aggregate(null, [TEAM_A, TEAM_A, TEAM_A]);
  assert.equal(result.status, "live");
  assert.equal(result.winnerTeamId, null);
});
