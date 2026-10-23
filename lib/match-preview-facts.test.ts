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
import { briefingTeamsNeedingData, mergeLeaguepediaBriefingData, type BriefingData, type LeaguepediaBriefingRows } from "./match-briefing-data.ts";
import { buildMatchBriefingStats } from "./match-briefing-stats.ts";
import { addBriefingTimelineMetrics, addBriefingTimelineObjectives } from "./sync/leaguepedia-briefing.ts";
import { mergeTeamBriefingSourceRows, addBriefingChampionIds } from "./sync/team-briefing-source.ts";
import { supplementOracleBriefingRows } from "./oracles-elixir-briefing.ts";

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

{
  const match = { id: "upcoming", teamAId: "g2", teamBId: "t1", matchDate: "2026-10-23T10:00:00Z" } as Match;
  const teams = [
    { id: "g2", name: "G2 Esports", leaguepediaPage: "G2 Esports", shortName: "G2" },
    { id: "t1", name: "T1", leaguepediaPage: "T1", shortName: "T1" },
  ] as Team[];
  const empty = (): BriefingData => ({ matches: [], sets: [], playerStats: [] });
  function fixture(): LeaguepediaBriefingRows {
    return {
      matches: [{ MatchId: "LEC_final", MatchDateTime: "2026-09-20 15:00:00", Team1: "G2 Esports", Team2: "T1", Team1Score: "1", Team2Score: "0", Winner: "1" }],
      games: [{ MatchId: "LEC_final", GameId: "game1", N_GameInMatch: "1", Team1: "G2 Esports", Team2: "T1", Winner: "1", Gamelength: "30:00", Team1Kills: "10", Team2Kills: "5", Team1Gold: "55.1", Team2Gold: "50.2" }],
      players: ["G2 Esports", "T1"].flatMap((Team, side) => ["Top", "Jungle", "Mid", "Bot", "Support"].map((Role, index) => ({
        GameId: "game1", Team, Side: side ? "Red" : "Blue", Role, Link: `${Team}${index}`, ChampionId: `champion${index}`, Kills: "2", Deaths: "1", Assists: "3", CS: "200", Gold: "11000", DamageToChampions: "15000", VisionScore: "20",
      }))),
    };
  }

  test("empty teams request supplementation; source result supplies records and four box-score axes", () => {
    assert.deepEqual(briefingTeamsNeedingData(match, empty()), ["g2", "t1"]);
    const data = mergeLeaguepediaBriefingData(match, empty(), fixture(), teams, []);
    const stats = buildMatchBriefingStats(match, data.matches, data.sets, data.playerStats);
    assert.equal(stats.teamA.wins, 1);
    assert.equal(stats.teamB.losses, 1);
    assert.equal(stats.teamA.setWinRate, 100);
    assert.deepEqual(stats.teamA.values, [5, 2500, 100, 1000 / 30, null, null, null, null]);
    assert.equal(data.sets[0].blueGold, 55100);
    assert.equal(data.playerStats[0].championId, "champion0");
  });

  test("Leaguepedia champions map to the same DB IDs as native LCK records", () => {
    const rows = fixture();
    delete rows.players[0].ChampionId;
    rows.players[0].Champion = "K'Sante";
    rows.players[1].Champion = "Graves";
    addBriefingChampionIds(rows, [{ id: "ksante-db", name: "크산테", slug: "ksante", ddragon_id: "KSante" }]);
    assert.equal(rows.players[0].ChampionId, "ksante-db");
    assert.equal(rows.players[1].ChampionId, "catalog:Graves");
    const base = mergeLeaguepediaBriefingData(match, empty(), fixture(), teams, []);
    base.playerStats[0].championId = null;
    rows.players[0].VisionScore = "";
    const merged = mergeLeaguepediaBriefingData(match, base, rows, teams, []);
    assert.equal(merged.playerStats[0].championId, "ksante-db");
  });

  test("Oracle team metrics remain team totals and only verified player records fill lane metrics", () => {
    const rows = fixture();
    rows.games[0].MatchHistory = "https://lpl.qq.com/es/stats.shtml?bmid=123";
    rows.players[0].Champion = "Ahri";
    const common = { gameid: "123-123_game_1", league: "LPL", datacompleteness: "complete", game: "1", gamelength: "1800", date: "2026-09-20 15:05:00" };
    const teamRows = [
      { ...common, teamname: "G2 Esports", side: "Blue", result: "1", position: "team", golddiffat15: "700", xpdiffat15: "-100" },
      { ...common, teamname: "T1", side: "Red", result: "0", position: "team", golddiffat15: "-700", xpdiffat15: "100" },
    ];
    const source = { url: "https://example.test/oracle.csv", snapshotDate: "2026-09-21", aliases: [] };
    const oracle = [...teamRows, { ...common, teamname: "G2 Esports", side: "Blue", result: "1", position: "top", playername: "G2 Esports0", champion: "Ahri", kills: "2", deaths: "1", assists: "3", goldat15: "5200", opp_goldat15: "5000" }];
    const enriched = supplementOracleBriefingRows(rows, oracle, source);
    assert.equal(enriched.games[0].Team1GoldDiffAt15, "700");
    assert.equal(enriched.players[0].GoldDiffAt15, "200");
    assert.equal(enriched.players[1].GoldDiffAt15, undefined);
    assert.equal(rows.players[0].GoldDiffAt15, undefined);
    const data = mergeLeaguepediaBriefingData(match, empty(), enriched, teams, []);
    const stats = buildMatchBriefingStats(match, data.matches, data.sets, data.playerStats);
    assert.equal(stats.teamA.values[6], 700);
    assert.equal(stats.teamA.values[7], -100);
    assert.equal(stats.teamB.values[6], -700);
    assert.equal(data.playerStats[1].goldDiffAt15, null);
    const wrong = supplementOracleBriefingRows(rows, oracle.map((row) => ({ ...row, gamelength: "2000" })), source);
    assert.equal(wrong.games[0].Team1GoldDiffAt15, undefined);
    assert.equal(wrong.players[0].GoldDiffAt15, undefined);
    const inconsistent = supplementOracleBriefingRows(rows, teamRows.map((row) => ({ ...row, golddiffat15: "700" })), source);
    assert.equal(inconsistent.games[0].Team1GoldDiffAt15, undefined);
    const snapshotRows = teamRows.map((row, index) => ({ ...row, position: undefined, participantid: index ? "200" : "100" }));
    assert.equal(supplementOracleBriefingRows(rows, snapshotRows, source).games[0].Team1GoldDiffAt15, "700");
  });

  test("Leaguepedia dragon timing uses actual events and excludes Elder", () => {
    const rows = fixture();
    addBriefingTimelineObjectives(rows.games[0], [{ timestamp: 1_000_000, events: [
      { type: "ELITE_MONSTER_KILL", timestamp: 900_000, killerTeamId: 100, monsterSubType: "ELDER_DRAGON" },
      { type: "ELITE_MONSTER_KILL", timestamp: 600_000, killerTeamId: 100, monsterSubType: "AIR_DRAGON" },
      { type: "ELITE_MONSTER_KILL", timestamp: 500_000, killerId: 7, monsterType: "DRAGON" },
      { type: "ELITE_MONSTER_KILL", timestamp: 800_000, killerTeamId: 100, monsterSubType: "EARTH_DRAGON" },
    ] }]);
    assert.equal(rows.games[0].BlueFirstDragonMs, "600000");
    assert.equal(rows.games[0].RedFirstDragonMs, "500000");
    const data = mergeLeaguepediaBriefingData(match, empty(), rows, teams, []);
    assert.equal(data.sets[0].blueFirstDragonAtMs, 600000);
    assert.equal(data.sets[0].redFirstDragonAtMs, 500000);
  });

  test("source IDs reuse local match, set and player and preserve locally collected metrics", () => {
    const rows = fixture();
    const player = { id: "local-player", name: "G2 Esports0", leaguepediaPage: "G2 Esports0" } as Player;
    const base = mergeLeaguepediaBriefingData(match, empty(), rows, teams, [player]);
    base.matches[0].id = "local-match";
    base.sets[0].matchId = "local-match";
    base.sets[0].id = "local-set";
    base.playerStats.forEach((line) => { line.setId = "local-set"; line.goldDiffAt10 = 123; });
    rows.players[0].GoldDiffAt10 = "999";
    const merged = mergeLeaguepediaBriefingData(match, base, rows, teams, [player]);
    assert.equal(merged.matches.length, 1);
    assert.equal(merged.sets.length, 1);
    assert.equal(merged.playerStats.length, 10);
    assert.equal(merged.playerStats[0].playerId, "local-player");
    assert.equal(merged.playerStats[0].goldDiffAt10, 123);
    assert.equal(base.playerStats[0].goldDiffAt10, 123);
  });

  test("future and unfinished matches cannot leak into briefing history", () => {
    const rows = fixture();
    rows.matches[0].MatchDateTime = "2026-10-24 15:00:00";
    assert.equal(mergeLeaguepediaBriefingData(match, empty(), rows, teams, []).matches.length, 0);
    rows.matches[0].MatchDateTime = "2026-09-20 15:00:00";
    rows.matches[0].Winner = "";
    assert.equal(mergeLeaguepediaBriefingData(match, empty(), rows, teams, []).matches.length, 0);
  });

  test("missing source metrics do not become fabricated zeroes or partial team totals", () => {
    const rows = fixture();
    rows.players[0].DamageToChampions = "";
    const data = mergeLeaguepediaBriefingData(match, empty(), rows, teams, []);
    const stats = buildMatchBriefingStats(match, data.matches, data.sets, data.playerStats);
    assert.equal(stats.teamA.statSetCount, 0);
    assert.deepEqual(stats.teamA.values, Array(8).fill(null));
    assert.equal(stats.teamA.wins, 1);
  });

  test("timeline accepts Riot snapshot drift and numeric source sides", () => {
    const rows = fixture();
    rows.players[0].Side = "1";
    rows.players[5].Side = "2";
    addBriefingTimelineMetrics(rows.players, [{ timestamp: 600096, participantFrames: {
      "1": { totalGold: 4000, xp: 5000 }, "6": { totalGold: 3500, xp: 4800 },
    } }]);
    assert.equal(rows.players[0].GoldDiffAt10, "500");
    assert.equal(rows.players[5].GoldDiffAt10, "-500");
    assert.equal(rows.players[0].XpDiffAt10, "200");
    assert.equal(rows.players[0].GoldDiffAt15, undefined);
  });

  test("Leaguepedia 15-minute metrics fill existing records even with incomplete source box scores", () => {
    const rows = fixture();
    const base = mergeLeaguepediaBriefingData(match, empty(), rows, teams, []);
    rows.players[0].VisionScore = "";
    rows.players[0].GoldDiffAt15 = "450";
    rows.players[0].XpDiffAt15 = "0";
    const merged = mergeLeaguepediaBriefingData(match, base, rows, teams, []);
    assert.equal(merged.playerStats.length, 10);
    assert.equal(merged.playerStats[0].goldDiffAt15, 450);
    assert.equal(merged.playerStats[0].xpDiffAt15, 0);
    assert.equal(merged.playerStats[0].visionScore, 20);
    assert.equal(base.playerStats[0].goldDiffAt15, null);
  });

  test("twenty complete sets and all eight axes do not request external data", () => {
    const data = empty();
    for (let index = 0; index < 20; index++) {
      const rows = fixture();
      rows.matches[0].MatchId = `match${index}`;
      rows.games[0].MatchId = `match${index}`;
      rows.games[0].GameId = `game${index}`;
      rows.matches[0].MatchDateTime = `2026-09-${String(25 - index).padStart(2, "0")} 15:00:00`;
      rows.players.forEach((row) => Object.assign(row, { GameId: `game${index}`, GoldDiffAt10: "0", XpDiffAt10: "0", GoldDiffAt15: "0", XpDiffAt15: "0" }));
      Object.assign(data, mergeLeaguepediaBriefingData(match, data, rows, teams, []));
    }
    assert.deepEqual(briefingTeamsNeedingData(match, data), []);
    data.playerStats[0].goldDiffAt15 = null;
    // 다른 19세트의 평균이 존재해도 한 세트가 누락되면 보충해야 한다.
    assert.deepEqual(briefingTeamsNeedingData(match, data), ["g2"]);
  });

  test("source refresh preserves verified metrics only for matches in the new sample", () => {
    const previous = fixture();
    previous.players[0].GoldDiffAt15 = "450";
    previous.players[0].XpDiffAt15 = "0";
    const incoming = fixture();
    incoming.players[0].GoldDiffAt15 = "";
    incoming.players[0].Kills = "4";
    const merged = mergeTeamBriefingSourceRows(previous, incoming);
    assert.equal(merged.players.length, 10);
    assert.equal(merged.players[0].GoldDiffAt15, "450");
    assert.equal(merged.players[0].XpDiffAt15, "0");
    assert.equal(merged.players[0].Kills, "4");
    const partial = mergeTeamBriefingSourceRows(previous, { matches: incoming.matches, games: [], players: [] });
    assert.equal(partial.games.length, 1);
    assert.equal(partial.players.length, 10);
    const newer = fixture();
    newer.matches[0].MatchId = "new-match";
    newer.games = [];
    newer.players = [];
    const refreshed = mergeTeamBriefingSourceRows(previous, newer);
    assert.equal(refreshed.matches.length, 1);
    assert.equal(refreshed.matches[0].MatchId, "new-match");
    assert.equal(refreshed.games.length, 0);
    assert.equal(refreshed.players.length, 0);
    assert.equal(previous.players[0].Kills, "2");
  });

  test("foreign roster players contribute supplemented statistics to AI facts", () => {
    const players = [{ id: "foreign-top", name: "G2 Esports0", leaguepediaPage: "G2 Esports0", teamId: "g2", position: "TOP", isLckPlayer: false, isActive: true }] as Player[];
    const data = mergeLeaguepediaBriefingData(match, empty(), fixture(), teams, players);
    const facts = buildMatchPreviewFacts({ match, teams, players, ...data });
    assert.equal(facts.roleMatchups[0].teamA?.player, "G2 Esports0");
    assert.equal(facts.roleMatchups[0].teamA?.games, 1);
    assert.equal(facts.roleMatchups[0].teamA?.dpm, 500);
  });

  test("box-score team order does not override the actual blue and red sides", () => {
    const rows = fixture();
    rows.players.forEach((row) => { row.Side = row.Team === "G2 Esports" ? "2" : "1"; });
    const data = mergeLeaguepediaBriefingData(match, empty(), rows, teams, []);
    assert.equal(data.sets[0].blueTeamId, "t1");
    assert.equal(data.sets[0].redTeamId, "g2");
    assert.equal(data.sets[0].winnerTeamId, "g2");
    assert.equal(data.sets[0].blueGold, 50200);
    assert.equal(data.sets[0].redKills, 10);
  });
}
