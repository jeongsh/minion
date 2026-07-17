import assert from "node:assert/strict";
import { test } from "node:test";

import type { Match, Team } from "./types.ts";
import { buildMatchPreviewFacts } from "./match-preview-facts.ts";

const teams = ["A", "B", "C", "D", "E", "F", "G"].map((id) => ({
  id,
  slug: id.toLowerCase(),
  name: id,
  shortName: id,
})) as Team[];

function match({
  id,
  day,
  teamAId,
  teamBId,
  winnerTeamId,
  score,
}: {
  id: string;
  day: number;
  teamAId: string;
  teamBId: string;
  winnerTeamId: string;
  score: [number, number];
}): Match {
  return {
    id,
    tournamentId: "tournament",
    stageId: "stage",
    name: id,
    matchDate: `2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    status: "completed",
    teamAId,
    teamBId,
    teamAScore: score[0],
    teamBScore: score[1],
    winnerTeamId,
    officialPomPlayerId: null,
    groupIndex: 0,
  };
}

test("완승 기록과 대진 난이도·접전 승리를 분리한다", () => {
  const history = [
    match({ id: "d-e", day: 1, teamAId: "D", teamBId: "E", winnerTeamId: "D", score: [3, 0] }),
    match({ id: "d-f", day: 2, teamAId: "D", teamBId: "F", winnerTeamId: "D", score: [3, 0] }),
    match({ id: "d-g", day: 3, teamAId: "D", teamBId: "G", winnerTeamId: "D", score: [3, 0] }),
    match({ id: "e-c", day: 4, teamAId: "E", teamBId: "C", winnerTeamId: "E", score: [3, 0] }),
    match({ id: "f-c", day: 5, teamAId: "F", teamBId: "C", winnerTeamId: "F", score: [3, 0] }),
    match({ id: "a-c", day: 6, teamAId: "A", teamBId: "C", winnerTeamId: "A", score: [3, 0] }),
    match({ id: "b-d", day: 7, teamAId: "B", teamBId: "D", winnerTeamId: "B", score: [3, 2] }),
  ];
  const current = {
    ...match({ id: "a-b", day: 10, teamAId: "A", teamBId: "B", winnerTeamId: "A", score: [0, 0] }),
    status: "scheduled" as const,
    winnerTeamId: null,
  };

  const facts = buildMatchPreviewFacts({ match: current, teams, matches: [...history, current], sets: [] });

  assert.equal(facts.firstMeeting, true);
  assert.equal(facts.teamA.cleanWins, 1);
  assert.equal(facts.teamA.closeWins, 0);
  assert.equal(facts.teamB.cleanWins, 0);
  assert.equal(facts.teamB.closeWins, 1);
  assert.ok(
    (facts.teamB.averageOpponentRating ?? 0) > (facts.teamA.averageOpponentRating ?? 0),
    "강팀 D를 만난 B의 대진 난이도가 약팀 C를 만난 A보다 높아야 한다",
  );
});
