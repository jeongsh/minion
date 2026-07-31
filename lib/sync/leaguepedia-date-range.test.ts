import assert from "node:assert/strict";
import test from "node:test";

import { leaguepediaKstDateRange } from "./leaguepedia-date-range.ts";
import { cursorWithLookback } from "./leaguepedia-lck-2026.ts";

test("converts inclusive KST calendar dates to a UTC half-open range", () => {
  assert.deepEqual(leaguepediaKstDateRange("2026-07-28", "2026-07-30"), {
    startIso: "2026-07-27T15:00:00.000Z",
    endExclusiveIso: "2026-07-30T15:00:00.000Z",
  });
});

test("rejects reversed and overly long ranges", () => {
  assert.throws(
    () => leaguepediaKstDateRange("2026-07-30", "2026-07-28"),
    /종료일/,
  );
  assert.throws(
    () => leaguepediaKstDateRange("2026-01-01", "2026-02-01"),
    /최대 31일/,
  );
});

test("moves the incremental cursor back by the configured overlap", () => {
  assert.equal(
    cursorWithLookback("2026-07-30T08:00:00.000Z", 3),
    "2026-07-27T08:00:00.000Z",
  );
  assert.equal(cursorWithLookback(null, 3), null);
});
