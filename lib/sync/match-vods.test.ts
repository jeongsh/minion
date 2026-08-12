import assert from "node:assert/strict";
import test from "node:test";

import { isMatchVodAutomationCandidate } from "./match-vods.ts";

const now = new Date("2026-08-12T12:00:00.000Z");
const match = { match_date: "2026-08-12T03:00:00.000Z" };

test("waits three hours after the last recorded set result", () => {
  assert.equal(
    isMatchVodAutomationCandidate(
      match,
      [{ status: "finished", result_recorded_at: "2026-08-12T10:00:00.000Z", vod_url: null, vod_thumbnail_url: null }],
      now,
    ),
    false,
  );
  assert.equal(
    isMatchVodAutomationCandidate(
      match,
      [{ status: "finished", result_recorded_at: "2026-08-12T08:59:59.000Z", vod_url: null, vod_thumbnail_url: null }],
      now,
    ),
    true,
  );
});

test("only retries completed sets with missing VOD data", () => {
  assert.equal(
    isMatchVodAutomationCandidate(
      match,
      [{ status: "scheduled", result_recorded_at: null, vod_url: null, vod_thumbnail_url: null }],
      now,
    ),
    false,
  );
  assert.equal(
    isMatchVodAutomationCandidate(
      match,
      [{ status: "finished", result_recorded_at: "2026-08-12T08:00:00.000Z", vod_url: "https://example.com/vod", vod_thumbnail_url: "https://example.com/thumb.jpg" }],
      now,
    ),
    false,
  );
});
