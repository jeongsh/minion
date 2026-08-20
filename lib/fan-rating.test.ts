import assert from "node:assert/strict";
import test from "node:test";

import { fanPogPlayerIdForSet } from "./fan-rating.ts";

const ratings = [
  { setId: "set-1", playerId: "winner-player", teamId: "winner-team", rating: 4, createdAt: "2026-08-20T10:00:00Z" },
  { setId: "set-1", playerId: "loser-player", teamId: "loser-team", rating: 5, createdAt: "2026-08-20T10:01:00Z" },
];

test("fan POG is selected only from the set winner", () => {
  assert.equal(fanPogPlayerIdForSet("set-1", "winner-team", ratings), "winner-player");
});

test("fan POG is not selected until the set winner is known", () => {
  assert.equal(fanPogPlayerIdForSet("set-1", null, ratings), null);
});
