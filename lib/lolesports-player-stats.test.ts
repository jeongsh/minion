import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeChampionLevel } from "./lolesports-player-stats.ts";

test("keeps champion levels accepted by the database constraint", () => {
  assert.equal(normalizeChampionLevel(1), 1);
  assert.equal(normalizeChampionLevel(12), 12);
  assert.equal(normalizeChampionLevel(18), 18);
});

test("turns invalid or provisional live-feed levels into null", () => {
  assert.equal(normalizeChampionLevel(0), null);
  assert.equal(normalizeChampionLevel(19), null);
  assert.equal(normalizeChampionLevel(12.5), null);
  assert.equal(normalizeChampionLevel(Number.NaN), null);
  assert.equal(normalizeChampionLevel(null), null);
  assert.equal(normalizeChampionLevel(undefined), null);
});
