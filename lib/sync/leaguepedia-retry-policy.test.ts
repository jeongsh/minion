import assert from "node:assert/strict";
import test from "node:test";

import { leaguepediaRetryAt } from "./leaguepedia-retry-policy.ts";

const now = new Date("2026-07-04T07:00:00.000Z");

test("retries missing or incomplete Leaguepedia data after five minutes", () => {
  assert.equal(leaguepediaRetryAt(now, "waiting_for_source"), "2026-07-04T07:05:00.000Z");
  assert.equal(leaguepediaRetryAt(now, "failed"), "2026-07-04T07:05:00.000Z");
});

test("keeps Leaguepedia rate-limit retries at ten minutes", () => {
  assert.equal(leaguepediaRetryAt(now, "rate_limited"), "2026-07-04T07:10:00.000Z");
});
