import assert from "node:assert/strict";
import { test } from "node:test";
import { buildLeagueSetRecord, buildMatchBriefingVisuals, buildChampionPriority, briefingDragonEvents, buildFirstDragonMinutes, buildTeamStyles } from "./match-preview-visuals.ts";
import { buildMatchPreviewAccuracy, accuracyRate } from "./match-preview-accuracy.ts";
import { trimBriefingMatchesToSets } from "./sync/leaguepedia-briefing.ts";
import type { Match, PlayerStatLine, SetResult, Team, Tournament } from "./types.ts";

const current = { id: "next", tournamentId: "worlds", matchDate: "2026-10-21T10:00:00Z", teamAId: "a", teamBId: "b" } as Match;
const past = { id: "past", tournamentId: "worlds", matchDate: "2026-10-20T10:00:00Z", status: "completed", teamAId: "a", teamBId: "b", winnerTeamId: "a", teamAScore: 2, teamBScore: 1 } as Match;
const sets = [
  { id: "s1", matchId: "past", blueTeamId: "a", redTeamId: "b", winnerTeamId: "a", blueKills: 20, redKills: 10, blueDragons: 3, redDragons: 1, durationSeconds: 1800 },
  { id: "s2", matchId: "past", blueTeamId: "b", redTeamId: "a", winnerTeamId: "b", blueKills: 15, redKills: 5, blueDragons: 2, redDragons: 2, durationSeconds: 2400 },
  { id: "s3", matchId: "past", blueTeamId: "a", redTeamId: "b", winnerTeamId: "a", blueKills: 12, redKills: 6, blueDragons: 4, redDragons: 0, durationSeconds: 1500 },
] as SetResult[];

test("최근 경기를 세트 수가 기준에 처음 닿을 때까지만 남긴다", () => {
  const rows = [{ Team1Score: "2", Team2Score: "1" }, { Team1Score: "1", Team2Score: "0" }, { Team1Score: "2", Team2Score: "0" }];
  assert.equal(trimBriefingMatchesToSets(rows, 4).length, 2);
  assert.equal(trimBriefingMatchesToSets(rows, 20).length, 3);
});

test("진영 승률과 운영 지표는 팀 관점으로 집계하고 주전의 15분 골드 격차만 평균낸다", () => {
  const lines = [
    { setId: "s1", teamId: "a", playerId: "top1", position: "TOP", goldDiffAt15: 300 },
    { setId: "s2", teamId: "a", playerId: "top1", position: "TOP", goldDiffAt15: null },
    { setId: "s3", teamId: "a", playerId: "top1", position: "TOP", goldDiffAt15: 100 },
    { setId: "s2", teamId: "a", playerId: "sub", position: "TOP", goldDiffAt15: -900 },
  ] as PlayerStatLine[];
  const { teamA } = buildMatchBriefingVisuals(current, [past], sets, lines);
  assert.deepEqual(teamA.blue, { wins: 2, games: 2 });
  assert.deepEqual(teamA.red, { wins: 0, games: 1 });
  assert.equal(teamA.objectives.kills, (20 + 5 + 12) / 3);
  assert.equal(teamA.objectives.minutes, averageMinutes(1800, 2400, 1500));
  assert.deepEqual(teamA.lanes, [{ position: "TOP", playerId: "top1", games: 2, goldDiffAt15: 200 }]);
});

function averageMinutes(...seconds: number[]) {
  return seconds.reduce((sum, value) => sum + value / 60, 0) / seconds.length;
}

test("foreign snapshot champions and dragon timestamps reach the existing graphs", () => {
  const sourceSets = [{ ...sets[0], id: "leaguepedia-game:1", blueFirstDragonAtMs: 420000, redFirstDragonAtMs: 660000 }];
  const visuals = buildMatchBriefingVisuals(current, [past], sourceSets, []);
  const events = briefingDragonEvents(sourceSets, visuals.teamA.setIds);
  assert.deepEqual(buildFirstDragonMinutes(visuals.teamA, events), [7]);
  assert.deepEqual(buildFirstDragonMinutes(visuals.teamB, events), [11]);
  assert.deepEqual(briefingDragonEvents(sourceSets, ["other"]), []);
  assert.deepEqual(buildChampionPriority([visuals.teamA, visuals.teamB], [
    { setId: sourceSets[0].id, teamId: "a", championId: "Ahri" },
    { setId: sourceSets[0].id, teamId: "b", championId: "Ahri" },
  ] as PlayerStatLine[]), [{ championId: "Ahri", picksA: 1, picksB: 1 }]);
});

test("verified team GD15 fills the team radar without creating player lane statistics", () => {
  const sourceSets = [{ ...sets[0], blueGoldDiffAt15: 450, redGoldDiffAt15: -450 }];
  const styles = buildTeamStyles(current, [past], sourceSets, []);
  assert.equal(styles.teamA.values[0], 450);
  assert.equal(styles.teamB.values[0], -450);
  const visuals = buildMatchBriefingVisuals(current, [past], sourceSets, []);
  assert.deepEqual(visuals.teamA.lanes, []);
});

test("같은 시즌 국제 대회의 경기 전 세트만 지역별로 센다", () => {
  const teams = [{ id: "a", isLckTeam: true }, { id: "b", isLckTeam: false, region: "China" }] as Team[];
  const tournaments = [{ id: "worlds", season: 2026, category: "international" }] as Tournament[];
  assert.deepEqual(buildLeagueSetRecord({ match: current, teams, matches: [past], sets, tournaments }),
    { regionA: "Korea", regionB: "China", winsA: 2, winsB: 1 });
  assert.equal(buildLeagueSetRecord({ match: current, teams, matches: [{ ...past, matchDate: "2026-10-22T10:00:00Z" }], sets, tournaments }), null);
});

test("경기 시작 전에 저장된 50% 외 예측만 채점하고 20경기 미만은 비율을 숨긴다", () => {
  const tournaments = [{ id: "worlds", season: 2026, category: "international" }] as Tournament[];
  const accuracy = buildMatchPreviewAccuracy([
    { matchId: "past", winProbabilityA: 72, generatedAt: "2026-10-20T09:00:00Z" },
    { matchId: "late", winProbabilityA: 72, generatedAt: "2026-10-20T12:00:00Z" },
    { matchId: "even", winProbabilityA: 50, generatedAt: "2026-10-20T09:00:00Z" },
  ], [past, { ...past, id: "late" }, { ...past, id: "even" }], tournaments, 2026);
  assert.deepEqual(accuracy.all, { hits: 1, graded: 1 });
  assert.deepEqual(accuracy.confident, { hits: 1, graded: 1 });
  assert.deepEqual(accuracy.recent, [true]);
  assert.equal(accuracyRate(accuracy.all), null);
  assert.equal(accuracyRate({ hits: 15, graded: 20 }), 75);
});
