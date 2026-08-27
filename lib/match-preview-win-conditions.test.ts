import assert from "node:assert/strict";
import { test } from "node:test";

import type { MatchPreviewFacts } from "./match-preview-facts.ts";
import {
  buildMatchPreviewWinConditionCandidates,
  resolveMatchPreviewWinConditions,
} from "./match-preview-win-conditions.ts";

const facts: MatchPreviewFacts = {
  matchId: "match",
  matchup: "NS vs BFX",
  firstMeeting: false,
  priorMeetings: 5,
  teamA: {
    team: "NS",
    rating: 1540,
    recentRecord: "3승 2패",
    setRecord: "7승 6패",
    averageOpponentRating: 1510,
    cleanWins: 1,
    closeWins: 1,
    averageGameMinutes: 31,
    averageKills: 16.2,
    averageGoldDiff: 2725,
    averageDragons: 2.4,
    averageBarons: 0.8,
    averageTowers: 6.1,
    statSetCount: 12,
    recentSeries: [],
  },
  teamB: {
    team: "BFX",
    rating: 1510,
    recentRecord: "3승 2패",
    setRecord: "7승 6패",
    averageOpponentRating: 1500,
    cleanWins: 0,
    closeWins: 2,
    averageGameMinutes: 33,
    averageKills: 15.1,
    averageGoldDiff: 280,
    averageDragons: 1.6,
    averageBarons: 0.5,
    averageTowers: 4.8,
    statSetCount: 12,
    recentSeries: [],
  },
  commonOpponents: [],
  roleMatchups: [
    {
      position: "MID",
      teamA: {
        player: "Calix",
        position: "MID",
        games: 8,
        kda: 3.2,
        dpm: 610,
        damageShare: 0.26,
        goldDiffAt15: 180,
        xpDiffAt15: 120,
        csDiffAt15: 4,
      },
      teamB: {
        player: "VicLa",
        position: "MID",
        games: 8,
        kda: 3.5,
        dpm: 759,
        damageShare: 0.3,
        goldDiffAt15: -40,
        xpDiffAt15: 20,
        csDiffAt15: -1,
      },
    },
  ],
};

test("팀 운영 우위가 뚜렷하면 DPM보다 운영 후보가 먼저 온다", () => {
  const candidates = buildMatchPreviewWinConditionCandidates(facts);

  assert.equal(candidates.teamA[0]?.axis, "economy");
  assert.equal(candidates.teamB[0]?.axis, "resilience");
});

test("모델이 양 팀 모두 DPM을 고르면 한쪽을 다른 축으로 교체한다", () => {
  const candidates = buildMatchPreviewWinConditionCandidates(facts);
  const resolved = resolveMatchPreviewWinConditions({
    candidates,
    teamACandidateId: "team-a-damage",
    teamBCandidateId: "team-b-damage",
    teamAText: "NS는 DPM으로 승부해야 한다.",
    teamBText: "BFX도 DPM으로 승부해야 한다.",
  });

  assert.notEqual(resolved.axes.teamA, resolved.axes.teamB);
  assert.equal([resolved.teamA, resolved.teamB].filter((text) => text?.includes("DPM")).length, 1);
});

test("알 수 없는 후보 id는 팀별 최상위이면서 서로 다른 축으로 보정한다", () => {
  const candidates = buildMatchPreviewWinConditionCandidates(facts);
  const resolved = resolveMatchPreviewWinConditions({
    candidates,
    teamACandidateId: "made-up",
    teamBCandidateId: "made-up",
    teamAText: "임의 문장",
    teamBText: "임의 문장",
  });

  assert.equal(resolved.axes.teamA, "economy");
  assert.equal(resolved.axes.teamB, "resilience");
  assert.match(resolved.teamA ?? "", /골드 차이/);
  assert.match(resolved.teamB ?? "", /접전승/);
  assert.match(resolved.teamA ?? "", /^NS는/);
  assert.match(resolved.teamB ?? "", /^BFX는/);
});

test("선수 데이터가 없어도 팀 지표만으로 서로 다른 조건을 만든다", () => {
  const candidates = buildMatchPreviewWinConditionCandidates({ ...facts, roleMatchups: [] });
  const resolved = resolveMatchPreviewWinConditions({
    candidates,
    teamACandidateId: null,
    teamBCandidateId: null,
    teamAText: null,
    teamBText: null,
  });

  assert.ok(resolved.teamA);
  assert.ok(resolved.teamB);
  assert.notEqual(resolved.axes.teamA, resolved.axes.teamB);
});
