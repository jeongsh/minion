import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  Match,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
  Tournament,
} from "./types.ts";
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

test("최근 주전 선수의 포지션별 지표를 프리뷰 사실에 포함한다", () => {
  const history = [
    match({ id: "a-c", day: 6, teamAId: "A", teamBId: "C", winnerTeamId: "A", score: [1, 0] }),
    match({ id: "b-d", day: 7, teamAId: "B", teamBId: "D", winnerTeamId: "B", score: [1, 0] }),
  ];
  const current = {
    ...match({ id: "a-b", day: 10, teamAId: "A", teamBId: "B", winnerTeamId: "A", score: [0, 0] }),
    status: "scheduled" as const,
    winnerTeamId: null,
  };
  const sets = [
    {
      id: "set-a",
      matchId: "a-c",
      setNumber: 1,
      status: "data_synced",
      winnerTeamId: "A",
      blueTeamId: "A",
      redTeamId: "C",
    },
    {
      id: "set-b",
      matchId: "b-d",
      setNumber: 1,
      status: "data_synced",
      winnerTeamId: "B",
      blueTeamId: "B",
      redTeamId: "D",
    },
  ] as SetResult[];
  const players = [
    { id: "a-mid", name: "Alpha", teamId: "A", position: "MID", isStarter: true },
    {
      id: "a-academy-mid",
      name: "Academy",
      teamId: "A",
      position: "MID",
      isStarter: false,
      importedScope: "challengers",
    },
    { id: "b-mid", name: "Bravo", teamId: "B", position: "MID", isStarter: true },
  ] as Player[];
  const stat = (
    setId: string,
    playerId: string,
    teamId: string,
    goldDiffAt15: number,
    dpm: number,
  ) => ({
    setId,
    playerId,
    teamId,
    position: "MID",
    kills: 4,
    deaths: 2,
    assists: 6,
    cs: 280,
    gold: 13_000,
    damageToChampions: 20_000,
    teamKills: 12,
    teamDamage: 60_000,
    gameMinutes: 30,
    visionScore: 20,
    dpm,
    goldDiffAt15,
    xpDiffAt15: goldDiffAt15 / 2,
    csDiffAt15: goldDiffAt15 / 50,
    itemIds: [],
    spellIds: [],
    runeIds: [],
    roleBoundItem: null,
    patch: null,
  }) as PlayerStatLine;

  const facts = buildMatchPreviewFacts({
    match: current,
    teams,
    matches: [...history, current],
    sets,
    players,
    playerStats: [
      stat("set-a", "a-mid", "A", 500, 700),
      stat("set-a", "a-academy-mid", "A", 900, 900),
      stat("set-a", "a-academy-mid", "A", 900, 900),
      stat("set-b", "b-mid", "B", -200, 550),
    ],
  });
  const mid = facts.roleMatchups.find((item) => item.position === "MID");

  assert.equal(mid?.teamA?.player, "Alpha");
  assert.equal(mid?.teamB?.player, "Bravo");
  assert.equal(mid?.teamA?.goldDiffAt15, 500);
  assert.equal(mid?.teamB?.dpm, 550);
  assert.equal(mid?.teamA?.kda, 5);
});

test("케스파컵 경기는 팀·선수 프리뷰 표본에서 제외한다", () => {
  const lck = match({
    id: "a-c-lck",
    day: 6,
    teamAId: "A",
    teamBId: "C",
    winnerTeamId: "A",
    score: [2, 0],
  });
  const kespa = {
    ...match({
      id: "a-d-kespa",
      day: 9,
      teamAId: "A",
      teamBId: "D",
      winnerTeamId: "D",
      score: [0, 2],
    }),
    tournamentId: "kespa",
  };
  const current = {
    ...match({
      id: "a-b-next",
      day: 10,
      teamAId: "A",
      teamBId: "B",
      winnerTeamId: "A",
      score: [0, 0],
    }),
    status: "scheduled" as const,
    winnerTeamId: null,
  };
  const tournaments = [
    { id: "tournament", name: "LCK 2026", season: 2026, category: "domestic", league: "LCK" },
    {
      id: "kespa",
      name: "KeSPA Cup 2026",
      season: 2026,
      category: "domestic",
      league: "KeSPA Cup",
    },
  ] as Tournament[];

  const facts = buildMatchPreviewFacts({
    match: current,
    teams,
    matches: [lck, kespa, current],
    sets: [],
    tournaments,
  });

  assert.equal(facts.teamA.recentSeries.length, 1);
  assert.equal(facts.teamA.recentSeries[0]?.opponent, "C");
  assert.equal(facts.teamA.recentSeries[0]?.result, "W");
});
