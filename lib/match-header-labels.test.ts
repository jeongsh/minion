import assert from "node:assert/strict";
import test from "node:test";

import { compactMatchStageName, compactMatchTournamentName } from "./match-header-labels.ts";

test("compact match header labels remove redundant season wording", () => {
  assert.equal(compactMatchTournamentName("LCK 2026 Season Playoffs"), "LCK PO");
  assert.equal(compactMatchTournamentName("2026 LCK Regular Season"), "LCK Regular");
  assert.equal(compactMatchStageName("Round 1"), "R1");
  assert.equal(compactMatchStageName("Grand Finals"), "Final");
});
