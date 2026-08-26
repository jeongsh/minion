import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildChampionDirectory,
  buildChampionDuos,
  buildChampionGameRows,
  buildChampionLoadoutPreferences,
  buildChampionMatchups,
  buildChampionOverview,
  buildChampionPlayerPreferences,
  buildCompletedItemSequenceSummaries,
  type ChampionAnalysisInput,
  type ChampionBuildEvent,
} from "./champion-analysis.ts";
import type {
  Champion,
  Match,
  Player,
  PlayerPosition,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Team,
  Tournament,
} from "./types.ts";

const A = { id: "a", slug: "a", name: "A" } satisfies Champion;
const B = { id: "b", slug: "b", name: "B" } satisfies Champion;
const X = { id: "x", slug: "x", name: "X" } satisfies Champion;
const Y = { id: "y", slug: "y", name: "Y" } satisfies Champion;
const OTHER = { id: "other", slug: "other", name: "Other" } satisfies Champion;

function makeSet(
  id: string,
  winnerTeamId: string | null,
  options: { matchId?: string; setNumber?: number; patch?: string | null } = {},
): SetResult {
  return {
    id,
    matchId: options.matchId ?? `match-${id}`,
    setNumber: options.setNumber ?? 1,
    status: winnerTeamId ? "data_synced" : "draft_done",
    winnerTeamId,
    blueTeamId: "blue",
    redTeamId: "red",
    durationSeconds: 1_800,
    blueKills: null,
    redKills: null,
    blueGold: null,
    redGold: null,
    blueDragons: null,
    redDragons: null,
    blueBarons: null,
    redBarons: null,
    blueTowers: null,
    redTowers: null,
    patch: options.patch ?? "16.1.1",
  };
}

type RequiredLineIdentity = {
  setId: string;
  playerId: string;
  teamId: string;
  position: PlayerPosition;
  championId: string;
};

function makeLine(
  identity: RequiredLineIdentity,
  overrides: Partial<PlayerStatLine> = {},
): PlayerStatLine {
  return {
    ...identity,
    championLevel: 18,
    kills: 1,
    deaths: 1,
    assists: 1,
    cs: 300,
    gold: 12_000,
    damageToChampions: 18_000,
    teamKills: 10,
    teamDamage: 50_000,
    gameMinutes: 30,
    visionScore: 30,
    itemIds: [],
    spellIds: [],
    runeIds: [],
    roleBoundItem: null,
    patch: "16.1.1",
    ...overrides,
  };
}

function completeDraft(
  setId: string,
  options: { picked?: string; banned?: string } = {},
): SetPickBan[] {
  const pickIds = Array.from({ length: 10 }, (_, index) => `pick-${setId}-${index}`);
  const banIds = Array.from({ length: 10 }, (_, index) => `ban-${setId}-${index}`);
  if (options.picked) pickIds[0] = options.picked;
  if (options.banned) banIds[0] = options.banned;

  const rows = [
    ...pickIds.map((championId, index) => ({
      id: `${setId}-pick-${index}`,
      setId,
      phase: index < 6 ? "pick1" : "pick2",
      actionType: "pick" as const,
      orderIndex: index < 6 ? index + 7 : index + 11,
      teamId: index % 2 === 0 ? "blue" : "red",
      championId,
      side: index % 2 === 0 ? "blue" as const : "red" as const,
    })),
    ...banIds.map((championId, index) => ({
      id: `${setId}-ban-${index}`,
      setId,
      phase: index < 6 ? "ban1" : "ban2",
      actionType: "ban" as const,
      orderIndex: index < 6 ? index + 1 : index + 7,
      teamId: index % 2 === 0 ? "blue" : "red",
      championId,
      side: index % 2 === 0 ? "blue" as const : "red" as const,
    })),
  ];
  return rows;
}

function makeMatch(id: string, date: string, tournamentId = "t1"): Match {
  return {
    id,
    tournamentId,
    stageId: "stage",
    name: id,
    matchDate: date,
    status: "completed",
    teamAId: "blue",
    teamBId: "red",
    teamAScore: 1,
    teamBScore: 0,
    winnerTeamId: "blue",
    officialPomPlayerId: null,
    groupIndex: 0,
  };
}

function makePlayer(id: string, teamId: string, position: PlayerPosition): Player {
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    realName: id,
    teamId,
    position,
    profileImageUrl: "",
  };
}

function makeTeam(id: string): Team {
  return {
    id,
    slug: id,
    name: id.toUpperCase(),
    shortName: id.toUpperCase(),
    logoUrl: "",
    logoWhiteUrl: "",
    backgroundUrl: "",
    primaryColor: "#000000",
    secondaryColor: "#ffffff",
    fanSiteHost: "",
    officialHomepageUrl: "",
    officialYoutubeUrl: "",
    officialXUrl: "",
    officialInstagramUrl: "",
  };
}

test("directory and overview use only complete drafts and keep bans global", () => {
  const sets = [makeSet("s1", "blue"), makeSet("s2", "red"), makeSet("s3", "blue")];
  const input: ChampionAnalysisInput = {
    champions: [A, B],
    sets,
    pickBans: [
      ...completeDraft("s1", { picked: A.id }),
      ...completeDraft("s2", { banned: A.id }),
      {
        id: "incomplete-ban",
        setId: "s3",
        phase: "ban1",
        actionType: "ban",
        orderIndex: 1,
        teamId: "blue",
        championId: A.id,
        side: "blue",
      },
    ],
    playerStats: [
      makeLine({ setId: "s1", playerId: "bot", teamId: "blue", position: "BOT", championId: A.id }),
      makeLine({ setId: "s2", playerId: "mid", teamId: "blue", position: "MID", championId: A.id }),
      makeLine({ setId: "s3", playerId: "bot", teamId: "blue", position: "BOT", championId: A.id }),
    ],
  };

  const overview = buildChampionOverview(input, A.id, "BOT");
  assert.deepEqual(overview.draft, {
    eligibleSets: 2,
    incompleteSets: 1,
    picks: 1,
    bans: 1,
    pickRate: 50,
    banRate: 50,
    presenceRate: 100,
  });
  assert.equal(overview.selected.picks, 2);
  assert.equal(overview.selected.games, 2);
  assert.equal(overview.selected.wins, 2);
  assert.equal(overview.overall.games, 3);
  assert.equal(overview.overall.wins, 2);
  assert.equal(overview.patchCoverage.recordedGames, 2);

  const row = buildChampionDirectory(input, { position: "BOT" }).find((entry) => entry.champion.id === A.id);
  assert.ok(row);
  assert.equal(row.record.picks, 2);
  assert.equal(row.draft.bans, 1, "a position filter must not manufacture position-scoped bans");
});

test("matchups join exactly one opponent in the same set and role and exclude missing metric values", () => {
  const sets = [
    makeSet("s1", "blue", { matchId: "m1" }),
    makeSet("s2", "red", { matchId: "m2" }),
    makeSet("s3", "blue", { matchId: "m3" }),
  ];
  const input: ChampionAnalysisInput = {
    champions: [A, X, Y],
    matches: [makeMatch("m1", "2026-01-01"), makeMatch("m2", "2026-01-03"), makeMatch("m3", "2026-01-02")],
    sets,
    pickBans: [],
    playerStats: [
      makeLine({ setId: "s1", playerId: "a1", teamId: "blue", position: "MID", championId: A.id }, { goldDiffAt15: 100 }),
      makeLine({ setId: "s1", playerId: "x1", teamId: "red", position: "MID", championId: X.id }),
      makeLine({ setId: "s2", playerId: "a2", teamId: "blue", position: "MID", championId: A.id }, { goldDiffAt15: null }),
      makeLine({ setId: "s2", playerId: "x2", teamId: "red", position: "MID", championId: X.id }),
      makeLine({ setId: "s3", playerId: "a3", teamId: "blue", position: "MID", championId: A.id }, { goldDiffAt15: -50 }),
      makeLine({ setId: "s3", playerId: "y1", teamId: "red", position: "MID", championId: Y.id }),
      makeLine({ setId: "s3", playerId: "wrong-role", teamId: "red", position: "TOP", championId: X.id }),
    ],
  };

  const matchups = buildChampionMatchups(input, A.id, "MID");
  assert.equal(matchups.length, 2);
  assert.equal(matchups[0].opponentChampionId, X.id);
  assert.equal(matchups[0].games, 2);
  assert.equal(matchups[0].wins, 1);
  assert.equal(matchups[0].metrics.goldDiffAt15.value, 100);
  assert.equal(matchups[0].metrics.goldDiffAt15.recordedGames, 1);
  assert.deepEqual(matchups[0].recentResults.map((row) => row.result), ["L", "W"]);
});

test("BOT and SUP duo win rate comes from exact shared games, never averaged individual rates", () => {
  const sets = Array.from({ length: 13 }, (_, index) => {
    const number = index + 1;
    const aOnly = number >= 3 && number <= 5;
    const bOnlyWin = number >= 6 && number <= 11;
    const winner = number === 1 || aOnly || bOnlyWin ? "blue" : "red";
    return makeSet(`s${number}`, winner);
  });
  const lines: PlayerStatLine[] = [];
  for (let number = 1; number <= 13; number += 1) {
    const setId = `s${number}`;
    const aSelected = number <= 5;
    const bSelected = number <= 2 || number >= 6;
    lines.push(makeLine(
      { setId, playerId: aSelected ? "adc-a" : `adc-other-${number}`, teamId: "blue", position: "BOT", championId: aSelected ? A.id : OTHER.id },
      { goldDiffAt15: number === 1 ? 100 : null },
    ));
    lines.push(makeLine(
      { setId, playerId: bSelected ? "sup-b" : `sup-other-${number}`, teamId: "blue", position: "SUP", championId: bSelected ? B.id : OTHER.id },
      { goldDiffAt15: number === 1 ? 50 : null },
    ));
  }
  const input: ChampionAnalysisInput = {
    champions: [A, B, OTHER],
    sets,
    pickBans: [],
    playerStats: lines,
  };

  assert.equal(buildChampionOverview(input, A.id, "BOT").selected.winRate, 80);
  assert.equal(buildChampionOverview(input, B.id, "SUP").selected.winRate, 70);

  const exact = buildChampionDuos(input, A.id, "BOT").find((duo) => duo.partnerChampionId === B.id);
  assert.ok(exact);
  assert.equal(exact.games, 2);
  assert.equal(exact.wins, 1);
  assert.equal(exact.winRate, 50, "the exact duo is 1-1, not the 75% mean of 80% and 70%");
  assert.deepEqual(exact.duoGoldDiffAt15, { value: 150, recordedGames: 1 });
});

test("loadouts preserve observed combinations, full rune pages, item boundaries and replayed purchases", () => {
  const runePage = [
    "Press the Attack",
    "Presence of Mind",
    "Legend: Alacrity",
    "Cut Down",
    "Taste of Blood",
    "Treasure Hunter",
    "Attack Speed",
    "Adaptive Force",
    "Health",
  ];
  const sets = [makeSet("s1", "blue"), makeSet("s2", "red"), makeSet("s3", "blue")];
  const playerStats = [
    makeLine(
      { setId: "s1", playerId: "adc", teamId: "blue", position: "BOT", championId: A.id },
      {
        runeIds: [8005, 8100],
        fullRuneNames: runePage,
        spellIds: [4, 7],
        itemIds: [1001, 3001, 3001, null, null, null, 3340],
        roleBoundItem: 3865,
      },
    ),
    makeLine(
      { setId: "s2", playerId: "adc", teamId: "blue", position: "BOT", championId: A.id },
      {
        runeIds: [8005, 8100],
        fullRuneNames: runePage.map((name) => name.toUpperCase()),
        spellIds: [7, 4],
        itemIds: [3001, 3865, 3002, null, null, null, 3363],
        roleBoundItem: 3865,
      },
    ),
    makeLine({ setId: "s3", playerId: "adc", teamId: "blue", position: "BOT", championId: A.id }),
  ];
  const buildEvents: ChampionBuildEvent[] = [
    { setId: "s1", playerId: "adc", timestampMs: 1_000, minute: 0, eventType: "ITEM_PURCHASED", itemId: 1001 },
    { setId: "s1", playerId: "adc", timestampMs: 2_000, minute: 0, eventType: "ITEM_PURCHASED", itemId: 2003 },
    { setId: "s1", playerId: "adc", timestampMs: 2_500, minute: 0, eventType: "SKILL_LEVEL_UP", itemId: null, skillSlot: 1, levelUpType: "NORMAL" },
    { setId: "s1", playerId: "adc", timestampMs: 3_000, minute: 0, eventType: "ITEM_UNDO", itemId: null, beforeItemId: 2003, afterItemId: 0 },
    { setId: "s1", playerId: "adc", timestampMs: 70_000, minute: 1, eventType: "SKILL_LEVEL_UP", itemId: null, skillSlot: 2, levelUpType: "NORMAL" },
    { setId: "s1", playerId: "adc", timestampMs: 100_000, minute: 1, eventType: "ITEM_PURCHASED", itemId: 3001 },
    { setId: "s1", playerId: "adc", timestampMs: 200_000, minute: 3, eventType: "ITEM_SOLD", itemId: 1001 },
  ];
  const input: ChampionAnalysisInput = {
    champions: [A],
    sets,
    pickBans: [],
    playerStats,
    buildEvents,
  };

  const loadouts = buildChampionLoadoutPreferences(input, A.id, "BOT");
  assert.equal(loadouts.coverage.runePair.recordedGames, 2);
  assert.equal(loadouts.coverage.runePair.totalGames, 3);
  assert.ok(Math.abs(loadouts.coverage.runePair.rate - (200 / 3)) < 1e-10);
  assert.equal(loadouts.coverage.runePair.isPartial, true);
  assert.equal(loadouts.fullRunePages.length, 1, "case variants of the same ordered page are one tuple");
  assert.equal(loadouts.fullRunePages[0].games, 2);
  assert.deepEqual(loadouts.spellCombinations[0].ids, [4, 7]);
  assert.equal(loadouts.spellCombinations[0].games, 2);
  assert.equal(loadouts.finalItems.find((item) => item.id === 3001)?.games, 2, "duplicate slots count once per game");
  assert.equal(loadouts.finalItems.some((item) => item.id === 3865), false, "role-bound items are separated");
  assert.equal(loadouts.roleBoundItems[0].id, 3865);
  assert.deepEqual(loadouts.finalItemCombinations.map((combo) => combo.ids), [[1001, 3001], [3001, 3002]]);
  assert.equal(loadouts.coverage.purchaseOrder.recordedGames, 1);
  assert.equal(loadouts.coverage.purchaseOrder.totalGames, 3);
  assert.ok(Math.abs(loadouts.coverage.purchaseOrder.rate - (100 / 3)) < 1e-10);
  assert.equal(loadouts.coverage.purchaseOrder.isPartial, true);
  assert.deepEqual(loadouts.purchaseSequences[0].ids, [1001, 3001]);
  assert.deepEqual(loadouts.gamePurchaseSequences[0].purchases.map((purchase) => [purchase.itemId, purchase.state]), [
    [1001, "sold"],
    [3001, "held"],
  ]);
  assert.equal(loadouts.coverage.skillOrder.recordedGames, 1);
  assert.equal(loadouts.coverage.skillOrder.totalGames, 3);
  assert.deepEqual(loadouts.skillOrders[0].ids, [1, 2]);
});

test("player preferences retain historical teams and game rows join metadata without inventing missing data", () => {
  const teamBlue = makeTeam("blue");
  const teamOld = makeTeam("old");
  const teamRed = makeTeam("red");
  const adc = makePlayer("adc", "blue", "BOT");
  const enemy = makePlayer("enemy", "red", "BOT");
  const tournament = { id: "t1", name: "Test League", season: 2026, category: "lck" } satisfies Tournament;
  const sets = [
    { ...makeSet("s1", "old", { matchId: "m1", setNumber: 1 }), blueTeamId: "old" },
    makeSet("s2", "red", { matchId: "m2", setNumber: 2, patch: null }),
  ];
  const input: ChampionAnalysisInput = {
    champions: [A, X],
    players: [adc, enemy],
    teams: [teamBlue, teamOld, teamRed],
    tournaments: [tournament],
    matches: [makeMatch("m1", "2026-02-01"), makeMatch("m2", "2026-02-03")],
    sets,
    pickBans: [],
    playerStats: [
      makeLine(
        { setId: "s1", playerId: adc.id, teamId: "old", position: "BOT", championId: A.id },
        { kills: 4, deaths: 0, assists: 6, dpm: 700, goldDiffAt15: 200 },
      ),
      makeLine({ setId: "s1", playerId: enemy.id, teamId: "red", position: "BOT", championId: X.id }),
      makeLine(
        { setId: "s2", playerId: adc.id, teamId: "blue", position: "BOT", championId: A.id },
        { kills: 1, deaths: 2, assists: 1, dpm: null, damageToChampions: 15_000, gameMinutes: 30, goldDiffAt15: null },
      ),
      makeLine({ setId: "s2", playerId: enemy.id, teamId: "red", position: "BOT", championId: X.id }),
    ],
  };

  const players = buildChampionPlayerPreferences(input, A.id, "BOT");
  assert.equal(players.length, 1);
  assert.equal(players[0].games, 2);
  assert.equal(players[0].wins, 1);
  assert.equal(players[0].kda, 6);
  assert.equal(players[0].dpm.value, 600);
  assert.equal(players[0].goldDiffAt15.recordedGames, 1);
  assert.deepEqual(players[0].historicalTeams.map((usage) => usage.teamId).sort(), ["blue", "old"]);
  assert.equal(players[0].lastUsedAt, "2026-02-03");

  const games = buildChampionGameRows(input, A.id, "BOT");
  assert.deepEqual(games.map((game) => game.setId), ["s2", "s1"]);
  assert.equal(games[0].opponentChampionId, X.id);
  assert.equal(games[0].tournamentName, "Test League");
  assert.equal(games[0].patch, "16.1", "the stat-line patch remains available when the set patch is missing");
  assert.equal(games[0].href, "/matches/m2?tab=data&set=s2");
  assert.equal(games[1].team?.id, "old", "the row uses the team recorded for that game, not the player's current team");
});

test("completed item paths preserve literal duplicate purchases and use observed-build games as denominator", () => {
  const sequences = buildCompletedItemSequenceSummaries({
    sequences: [
      {
        setId: "s1",
        playerId: "p1",
        purchases: [
          { itemId: 3001, timestampMs: 600_000, minute: 10, state: "sold" },
          { itemId: 3001, timestampMs: 900_000, minute: 15, state: "held" },
          { itemId: 3002, timestampMs: 1_200_000, minute: 20, state: "held" },
        ],
      },
      {
        setId: "s2",
        playerId: "p2",
        purchases: [
          { itemId: 1001, timestampMs: 60_000, minute: 1, state: "held" },
          { itemId: 3001, timestampMs: 720_000, minute: 12, state: "held" },
        ],
      },
    ],
    games: [
      { setId: "s1", playerId: "p1", result: "W" },
      { setId: "s2", playerId: "p2", result: "L" },
    ],
    isCompletedItem: (itemId) => itemId >= 3000,
  });

  assert.deepEqual(sequences.map((row) => row.ids), [[3001, 3001, 3002], [3001]]);
  assert.equal(sequences[0].games, 1);
  assert.equal(sequences[0].eligibleGames, 2);
  assert.equal(sequences[0].selectionRate, 50);
  assert.equal(sequences[0].winRate, 100);
});
