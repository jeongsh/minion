import assert from "node:assert/strict";
import { test } from "node:test";

import type { LolesportsEvent } from "./lolesports.ts";
import {
  findLolesportsMatch,
  hasConsistentCompletedScore,
  type LocalMatchCandidate,
} from "./lolesports-match-matcher.ts";

const local: LocalMatchCandidate = {
  id: "local-match",
  matchDate: "2026-06-14T06:00:00Z",
  lolesportsMatchId: null,
  teamA: { id: "t1", name: "T1", shortName: "T1" },
  teamB: { id: "gen", name: "Gen.G Esports", shortName: "GEN" },
};

function event(overrides: Partial<LolesportsEvent> = {}): LolesportsEvent {
  return {
    id: "event-1",
    startTime: "2026-06-14T06:00:00Z",
    state: "inProgress",
    league: { id: "98767991310872058", slug: "lck", name: "LCK" },
    matchTeams: [
      { id: "gen", name: "Gen.G Esports", code: "GEN", result: { gameWins: 1, outcome: null } },
      { id: "t1", name: "T1", code: "T1", result: { gameWins: 2, outcome: null } },
    ],
    match: {
      id: "lolesports-match",
      state: "inProgress",
      strategy: { type: "bestOf", count: 5 },
      games: [
        { id: "g1", number: 1, state: "completed" },
        { id: "g2", number: 2, state: "completed" },
        { id: "g3", number: 3, state: "completed" },
        { id: "g4", number: 4, state: "inProgress" },
        { id: "g5", number: 5, state: "unstarted" },
      ],
    },
    ...overrides,
  };
}

test("API 팀 순서와 무관하게 로컬 team A/B 스코어를 정렬한다", () => {
  const matched = findLolesportsMatch(local, [event()]);
  assert.ok(matched);
  assert.equal(matched.teamAScore, 2);
  assert.equal(matched.teamBScore, 1);
  assert.equal(matched.completedGameCount, 3);
  assert.equal(hasConsistentCompletedScore(matched), true);
});

test("스코어 합계와 completed 게임 수가 다르면 처리하지 않는다", () => {
  const inconsistent = event({
    match: {
      ...event().match,
      games: event().match.games.map((game, index) =>
        index === 2 ? { ...game, state: "inProgress" as const } : game,
      ),
    },
  });
  const matched = findLolesportsMatch(local, [inconsistent]);
  assert.ok(matched);
  assert.equal(hasConsistentCompletedScore(matched), false);
});

test("저장된 LoL Esports match ID가 있으면 같은 팀의 다른 경기보다 우선한다", () => {
  const withId = { ...local, lolesportsMatchId: "target-match" };
  const older = event({ id: "older-event", match: { ...event().match, id: "older-match" } });
  const target = event({
    id: "target-event",
    startTime: "2026-06-14T10:00:00Z",
    match: { ...event().match, id: "target-match" },
  });
  assert.equal(findLolesportsMatch(withId, [older, target])?.lolesportsMatchId, "target-match");
});

test("스폰서명이 붙은 API 팀 이름도 기존 로컬 팀과 매칭한다", () => {
  const msiLocal = {
    ...local,
    teamB: { id: "tl", name: "Team Liquid", shortName: "TL" },
  };
  const msiEvent = event({
    matchTeams: [
      { id: "t1", name: "T1", code: "T1", result: { gameWins: 3, outcome: "win" } },
      {
        id: "tlaw",
        name: "Team Liquid Alienware",
        code: "TLAW",
        result: { gameWins: 0, outcome: "loss" },
      },
    ],
    match: {
      ...event().match,
      state: "completed",
      games: event().match.games.slice(0, 3).map((game) => ({ ...game, state: "completed" })),
    },
  });
  const matched = findLolesportsMatch(msiLocal, [msiEvent]);
  assert.ok(matched);
  assert.equal(matched.teamAScore, 3);
  assert.equal(matched.teamBScore, 0);
});
