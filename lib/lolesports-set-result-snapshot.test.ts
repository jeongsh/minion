import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLolesportsSetResultSnapshot } from "./lolesports-set-result-snapshot.ts";
import type { AlignedLolesportsMatch } from "./lolesports-match-matcher.ts";

test("missing optional LoL Esports fields do not prevent a set snapshot", () => {
  const external: AlignedLolesportsMatch = {
    event: {
      matchTeams: [{ result: { gameWins: 1 } }, { result: { gameWins: 0 } }],
      match: { id: "external-match", state: "inProgress", games: [{ number: 1, state: "completed" }] },
    },
    lolesportsMatchId: "external-match",
    state: "inProgress",
    teamAScore: 1,
    teamBScore: 0,
    completedGameCount: 1,
    localTeamAId: "team-a",
    localTeamBId: "team-b",
    externalTeamAId: null,
    externalTeamBId: null,
  };

  const snapshot = buildLolesportsSetResultSnapshot(
    { setId: "set-1", matchId: "match-1", setNumber: 1, winnerTeamId: "team-a" },
    external,
    new Date("2026-07-03T00:00:00Z"),
  );

  assert.equal(snapshot.external_game_id, null);
  assert.equal(snapshot.external_winner_team_id, null);
  assert.equal(snapshot.winner_team_id, "team-a");
  assert.equal(snapshot.raw_payload.game?.number, 1);
});
