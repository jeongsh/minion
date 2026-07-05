import assert from "node:assert/strict";
import test from "node:test";

import { resolveLeaguepediaPickBanRows } from "./leaguepedia-pick-ban.ts";

const scoreboard = {
  GameId: "event_match_1",
  N_GameInMatch: "1",
  Team1: "Team A",
  Team2: "Team B",
  Team1Bans: "Cassiopeia,Varus,Rumble,Shen,Camille",
  Team2Bans: "Poppy,Ezreal,Orianna,Kai'Sa,Sivir",
  Team1Picks: "Olaf,Lee Sin,Ryze,Senna,Nautilus",
  Team2Picks: "Jayce,Jarvan IV,Yone,Ziggs,Rell",
};

test("falls back to ScoreboardGames when PicksAndBansS7 is an empty placeholder", () => {
  const [row] = resolveLeaguepediaPickBanRows([scoreboard], [{
    GameId: scoreboard.GameId,
    N_GameInMatch: "1",
    Team1: "",
    Team2: "",
    Team1Ban1: "",
  }]);

  assert.equal(row.Team1, "Team A");
  assert.equal(row.Team1Ban1, "Cassiopeia");
  assert.equal(row.Team1Ban5, "Camille");
  assert.equal(row.Team2Ban4, "Kai'Sa");
  assert.equal(row.Team1Pick2, "Lee Sin");
  assert.equal(row.Team2Pick5, "Rell");
});

test("keeps populated PicksAndBansS7 data as the primary source", () => {
  const [row] = resolveLeaguepediaPickBanRows([scoreboard], [{
    GameId: scoreboard.GameId,
    N_GameInMatch: "1",
    Team1: "Primary Team A",
    Team2: "Primary Team B",
    Team1Ban1: "Nocturne",
  }]);

  assert.equal(row.Team1, "Primary Team A");
  assert.equal(row.Team1Ban1, "Nocturne");
});

test("does not create draft rows when both sources are empty", () => {
  const rows = resolveLeaguepediaPickBanRows([{
    GameId: "event_match_2",
    N_GameInMatch: "2",
    Team1Bans: "",
    Team2Bans: "",
    Team1Picks: "",
    Team2Picks: "",
  }], []);

  assert.deepEqual(rows, []);
});
