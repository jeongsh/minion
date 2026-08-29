import assert from "node:assert/strict";
import test from "node:test";

import { isRecentTeamContent } from "./team-content.ts";

test("team content notifications accept the current sync window", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  assert.equal(isRecentTeamContent("2026-08-29T11:59:00.000Z", now), true);
  assert.equal(isRecentTeamContent("2026-08-28T12:00:00.000Z", now), true);
  assert.equal(isRecentTeamContent(null, now), true);
});

test("team content notifications reject stale, invalid, and far-future posts", () => {
  const now = Date.parse("2026-08-29T12:00:00.000Z");
  assert.equal(isRecentTeamContent("2026-08-28T11:59:59.999Z", now), false);
  assert.equal(isRecentTeamContent("not-a-date", now), false);
  assert.equal(isRecentTeamContent("2026-08-29T12:05:00.001Z", now), false);
});
