import assert from "node:assert/strict";
import test from "node:test";

import { isMatchLive } from "./match-display.ts";

test("a scheduled match stays upcoming after its scheduled start time", () => {
  assert.equal(isMatchLive({ status: "scheduled" }), false);
});

test("only an explicitly live match is displayed as live", () => {
  assert.equal(isMatchLive({ status: "live" }), true);
  assert.equal(isMatchLive({ status: "completed" }), false);
});
