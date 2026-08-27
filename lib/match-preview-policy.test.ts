import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPremiumMatchPreview,
  matchPreviewGenerationPhase,
  matchPreviewNeedsRefresh,
} from "./match-preview-policy.ts";
import type { Match, Stage, Tournament } from "./types.ts";

const hour = 60 * 60 * 1_000;
const now = Date.parse("2026-08-27T00:00:00.000Z");

test("자동 생성은 24시간 전 story와 2시간 전 final 두 단계다", () => {
  assert.equal(matchPreviewGenerationPhase(new Date(now + 25 * hour).toISOString(), now), null);
  assert.equal(matchPreviewGenerationPhase(new Date(now + 24 * hour).toISOString(), now), "story");
  assert.equal(matchPreviewGenerationPhase(new Date(now + 2 * hour).toISOString(), now), "final");
  assert.equal(matchPreviewGenerationPhase(new Date(now - hour).toISOString(), now), null);
});

test("같은 phase와 hash만 재생성을 건너뛴다", () => {
  assert.equal(matchPreviewNeedsRefresh({
    cachedHash: "same",
    expectedHash: "same",
    cachedPhase: "story",
    expectedPhase: "story",
  }), false);
  assert.equal(matchPreviewNeedsRefresh({
    cachedHash: "same",
    expectedHash: "same",
    cachedPhase: "story",
    expectedPhase: "final",
  }), true);
});

test("플레이오프·결승 또는 BO5는 프리미엄 생성 대상으로 본다", () => {
  const match = { bestOf: 3 } as Match;
  const tournament = { name: "LCK 2026", split: "Season", season: 2026 } as Tournament;
  const playoff = { name: "플레이오프 1라운드" } as Stage;

  assert.equal(isPremiumMatchPreview({ match, tournament, stage: playoff }), true);
  assert.equal(isPremiumMatchPreview({ match: { ...match, bestOf: 5 }, tournament }), true);
  assert.equal(isPremiumMatchPreview({ match, tournament }), false);
});
