import assert from "node:assert/strict";
import { test } from "node:test";

import { enrichmentRetryWindowStart } from "./lolesports-enrichment-policy.ts";

test("keeps due enrichment work eligible for seven days", () => {
  assert.equal(
    enrichmentRetryWindowStart(new Date("2026-08-04T12:00:00.000Z")),
    "2026-07-28T12:00:00.000Z",
  );
});
