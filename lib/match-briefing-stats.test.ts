import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMatchBriefingStats, matchBriefingSample } from "./match-briefing-stats.ts";
import type { Match, PlayerStatLine, SetResult, Team } from "./types.ts";
import { createMatchBriefingSnapshot, restoreMatchBriefingData, type LeaguepediaBriefingRows } from "./match-briefing-data.ts";
import { readFileSync } from "node:fs";

const current = { id: "next", matchDate: "2026-10-21T10:00:00Z", teamAId: "a", teamBId: "b" } as Match;
const past = { id: "past", matchDate: "2026-10-20T10:00:00Z", status: "completed", teamAId: "a", teamBId: "b", winnerTeamId: "a", teamAScore: 1, teamBScore: 0 } as Match;
const set = { id: "set", matchId: "past", blueTeamId: "a", redTeamId: "b", winnerTeamId: "a" } as SetResult;
function lines(teamId: string): PlayerStatLine[] {
  return (["TOP", "JGL", "MID", "BOT", "SUP"] as const).map((position, i) => ({
    setId: "set", teamId, playerId: `${teamId}-${i}`, position, kills: 2, deaths: 1, assists: 3,
    cs: 180, gold: 10000, damageToChampions: 18000, gameMinutes: 30, visionScore: 50,
    dpm: null, csPerMinute: null, goldDiffAt10: teamId === "a" ? 100 : -100,
    xpDiffAt10: 0, goldDiffAt15: teamId === "a" ? 200 : -200, xpDiffAt15: null,
  } as PlayerStatLine));
}

test("팀 지표는 5인의 합계를 사용하고 누락된 타임라인은 0점으로 채우지 않는다", () => {
  const result = buildMatchBriefingStats(current, [past], [set], [...lines("a"), ...lines("b")]);
  assert.deepEqual(result.teamA.values, [5, 3000, 250, 30, 500, 0, 1000, null]);
  assert.deepEqual(result.teamA.scores, [50, 50, 50, 50, 100, 50, 100, null]);
  assert.equal(result.teamA.setWinRate, 100);
  assert.deepEqual(result.teamA.form, ["W"]);
  assert.equal(result.teamB.values[6], -1000);
});

test("일부 선수만 수집된 세트는 팀 합계 비교에서 제외한다", () => {
  const result = buildMatchBriefingStats(current, [past], [set], [...lines("a").slice(0, 4), ...lines("b")]);
  assert.equal(result.teamA.statSetCount, 0);
  assert.ok(result.teamA.values.every((value) => value === null));
  assert.ok(result.teamB.scores.every((value) => value === null));
});

test("최근 다섯 매치만 선택하며 현재 경기와 이후 결과를 참조하지 않는다", () => {
  const matches = Array.from({ length: 7 }, (_, i) => ({ ...past, id: `m${i}`, matchDate: `2026-10-${String(20 - i).padStart(2, "0")}T10:00:00Z` }));
  const future = { ...past, id: "future", matchDate: "2026-10-22T10:00:00Z" };
  const sample = matchBriefingSample(current, [future, ...matches, { ...current, status: "completed", winnerTeamId: "a" }], []);
  assert.deepEqual(sample.byTeam.get("a")?.map((item) => item.id), ["m0", "m1", "m2", "m3", "m4"]);
});

const teams = [{ id: "a", name: "Alpha", shortName: "A", leaguepediaPage: "Alpha" },
  { id: "b", name: "Beta", shortName: "B", leaguepediaPage: "Beta" }] as Team[];
const ranking = { status: "ready" as const, sourceUrl: "https://lolesports.com/en-US/gpr/2026/current", teams: [] };
const rows: LeaguepediaBriefingRows = {
  matches: [{ MatchId: "source-match", MatchDateTime: "2026-10-20 10:00:00", Team1: "Alpha", Team2: "Beta", Team1Score: "1", Team2Score: "0", Winner: "1" }],
  games: [{ MatchId: "source-match", GameId: "source-game", N_GameInMatch: "1", Team1: "Alpha", Team2: "Beta", Winner: "1", Gamelength: "30:00", Team1Kills: "10", Team2Kills: "5" }],
  players: ["Alpha", "Beta"].flatMap((Team, side) => ["Top", "Jungle", "Mid", "Bot", "Support"].map((Role) => ({
    GameId: "source-game", Team, Side: String(side + 1), Role, Link: `${Team}-${Role}`,
    Kills: "2", Deaths: "1", Assists: "3", CS: "180", Gold: "10000", DamageToChampions: "18000", VisionScore: "50",
  }))),
};

test("생성 시 저장한 원본 기록을 JSON 왕복 후 외부 조회 없이 복원한다", () => {
  const snapshot = JSON.parse(JSON.stringify(createMatchBriefingSnapshot(current, [rows], ranking)));
  const restored = restoreMatchBriefingData(current, teams, [], { matches: [], sets: [], playerStats: [] }, snapshot);
  const stats = buildMatchBriefingStats(current, restored.matches, restored.sets, restored.playerStats);
  assert.equal(restored.matches.length, 1);
  assert.equal(restored.sets.length, 1);
  assert.equal(restored.playerStats.length, 10);
  assert.equal(stats.teamA.wins, 1);
  assert.equal(stats.teamA.values[1], 3000);
  assert.equal(stats.teamA.values[4], null);
  assert.deepEqual(restored.powerRankings, ranking);
});

test("정규 동기화된 경기와 세트가 생겨도 원본 ID로 병합해 중복하지 않는다", () => {
  const data = { matches: [{ ...past, leaguepediaMatchId: "source-match" }],
    sets: [{ ...set, leaguepediaGameId: "source-game", setNumber: 1 }], playerStats: [] };
  const restored = restoreMatchBriefingData(current, teams, [], data, createMatchBriefingSnapshot(current, [rows], ranking));
  assert.equal(restored.matches.length, 1);
  assert.equal(restored.matches[0].id, "past");
  assert.equal(restored.sets.length, 1);
  assert.equal(restored.sets[0].id, "set");
  assert.ok(restored.playerStats.every((line) => line.setId === "set"));
  assert.equal(data.playerStats.length, 0);
});

test("미생성 및 구버전 자료와 참가 팀 또는 일정이 달라진 자료는 DB 기록만 사용한다", () => {
  const data = { matches: [past], sets: [set], playerStats: lines("a") };
  const snapshot = createMatchBriefingSnapshot(current, [rows], ranking);
  for (const value of [undefined, { ...snapshot, teamAId: "other" }, { ...snapshot, matchDate: "2026-10-22T10:00:00Z" }]) {
    const restored = restoreMatchBriefingData(current, teams, [], data, value);
    assert.equal(restored.matches, data.matches);
    assert.equal(restored.sets, data.sets);
    assert.equal(restored.playerStats, data.playerStats);
    assert.equal(restored.powerRankings.status, "error");
  }
});

test("웹과 모바일 조회는 외부 기록 보충과 파워랭킹 수집을 호출하지 않는다", () => {
  for (const path of ["../app/matches/[matchId]/page.tsx", "../app/api/mobile/v1/matches/[matchId]/route.ts"]) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.doesNotMatch(source, /supplementMatchBriefingData|getPowerRankings|fetchLeaguepediaBriefingRows/);
    assert.match(source, /getStoredMatchBriefingData\(match, teams, players,/);
  }
});
