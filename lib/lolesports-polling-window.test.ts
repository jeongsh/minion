import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getLolesportsPollingStartsAt,
  shouldPollLolesportsEvents,
} from "./lolesports-polling-window.ts";

const matches = [
  { match_date: "2026-07-19T17:00:00+09:00" },
  { match_date: "2026-07-19T19:00:00+09:00" },
];

test("starts LoL Esports polling 30 minutes before the first match", () => {
  assert.equal(
    getLolesportsPollingStartsAt(matches)?.toISOString(),
    "2026-07-19T07:30:00.000Z",
  );
});

test("skips polling before the pre-match window", () => {
  assert.equal(shouldPollLolesportsEvents(matches, new Date("2026-07-19T07:29:59.000Z")), false);
});

test("allows polling during the pre-match window", () => {
  assert.equal(shouldPollLolesportsEvents(matches, new Date("2026-07-19T07:30:00.000Z")), true);
});

test("skips polling when no valid match time exists", () => {
  assert.equal(getLolesportsPollingStartsAt([{ match_date: "not-a-date" }]), null);
  assert.equal(shouldPollLolesportsEvents([{ match_date: "not-a-date" }]), false);
});
