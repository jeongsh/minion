import assert from "node:assert/strict";
import { test } from "node:test";

import { buildMatchPreviewStoryContext } from "./match-preview-story.ts";
import type {
  Match,
  Player,
  PlayerCareerHistory,
  Stage,
  Team,
  Tournament,
} from "./types.ts";

const teams = [
  { id: "a", name: "Alpha", shortName: "A", slug: "alpha" },
  { id: "b", name: "Bravo", shortName: "B", slug: "bravo" },
] as Team[];

const current: Match = {
  id: "current",
  tournamentId: "league",
  stageId: "playoff",
  name: "A vs B",
  matchDate: "2026-08-27T09:00:00.000Z",
  status: "scheduled",
  teamAId: "a",
  teamBId: "b",
  teamAScore: null,
  teamBScore: null,
  bestOf: 5,
  winnerTeamId: null,
  officialPomPlayerId: null,
  bracketSide: "lower",
  advancesToMatchId: "next",
  groupIndex: 0,
};

test("상대 팀 경력은 검증이 필요한 검색 후보로만 만든다", () => {
  const players = [
    { id: "a-bot", name: "Arrow", teamId: "a", position: "BOT", isActive: true },
    { id: "b-bot", name: "Bolt", teamId: "b", position: "BOT", isActive: true },
  ] as Player[];
  const careers = [
    {
      id: "arrow-b",
      playerId: "a-bot",
      teamId: "b",
      teamName: "Bravo",
      position: "BOT",
      startDate: "2025-01-01",
      endDate: "2026-06-01",
      notes: "season-level range",
    },
    {
      id: "bolt-a",
      playerId: "b-bot",
      teamId: "a",
      teamName: "Alpha",
      position: "BOT",
      startDate: "2025-01-01",
      endDate: null,
      notes: null,
    },
  ] as PlayerCareerHistory[];

  const context = buildMatchPreviewStoryContext({
    match: current,
    tournament: { id: "league", name: "League", season: 2026, category: "domestic" } as Tournament,
    stage: { id: "playoff", tournamentId: "league", bracketStageId: "bracket", name: "Playoffs", orderIndex: 1 } as Stage,
    teams,
    matches: [current],
    players,
    careerHistories: careers,
  });

  assert.equal(context.rosterLinks.length, 2);
  assert.equal(context.rosterLinks[0]?.verificationRequired, true);
  assert.equal(context.reciprocalMoveHint, true);
  assert.equal("transferDate" in context.rosterLinks[0]!, false);
  assert.equal("trade" in context.rosterLinks[0]!, false);
});

test("최근 맞대결은 현재 경기의 팀 순서로 스코어를 정규화한다", () => {
  const previous: Match = {
    ...current,
    id: "previous",
    matchDate: "2026-08-20T09:00:00.000Z",
    status: "completed",
    teamAId: "b",
    teamBId: "a",
    teamAScore: 1,
    teamBScore: 3,
    winnerTeamId: "a",
  };

  const context = buildMatchPreviewStoryContext({
    match: current,
    teams,
    matches: [previous, current],
  });

  assert.deepEqual(context.recentMeeting, {
    matchId: "previous",
    date: previous.matchDate,
    winner: "A",
    score: "3:1",
    daysBefore: 7,
  });
  assert.equal(context.stage, null);
});
