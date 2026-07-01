import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveSetStatus, hasCompletePlayerStats } from "./set-status.ts";

const BLUE = "blue-team";
const RED = "red-team";

function completeStats() {
  const positions = ["TOP", "JGL", "MID", "BOT", "SUP"];
  return [
    ...positions.map((position, index) => ({ playerId: `blue-${index}`, teamId: BLUE, position })),
    ...positions.map((position, index) => ({ playerId: `red-${index}`, teamId: RED, position })),
  ];
}

test("deriveSetStatus: 데이터 없음 -> scheduled", () => {
  const status = deriveSetStatus({ hasGameStats: false, hasPlayerStats: false, pickCount: 0, banCount: 0 });
  assert.equal(status, "scheduled");
});

test("deriveSetStatus: 밴픽 일부 -> draft_in_progress", () => {
  const status = deriveSetStatus({ hasGameStats: false, hasPlayerStats: false, pickCount: 3, banCount: 2 });
  assert.equal(status, "draft_in_progress");
});

test("deriveSetStatus: 기대 밴픽 완성(픽 10개) -> draft_done", () => {
  const status = deriveSetStatus({ hasGameStats: false, hasPlayerStats: false, pickCount: 10, banCount: 10 });
  assert.equal(status, "draft_done");
});

test("deriveSetStatus: 경기 통계 존재 -> finished", () => {
  const status = deriveSetStatus({ hasGameStats: true, hasPlayerStats: false, pickCount: 10, banCount: 10 });
  assert.equal(status, "finished");
});

test("deriveSetStatus: 완전한 선수 스탯 -> data_synced", () => {
  const status = deriveSetStatus({ hasGameStats: true, hasPlayerStats: true, pickCount: 10, banCount: 10 });
  assert.equal(status, "data_synced");
});

test("hasCompletePlayerStats: 10명 정상 -> true", () => {
  assert.equal(hasCompletePlayerStats(completeStats(), BLUE, RED), true);
});

test("hasCompletePlayerStats: 9명(1명 누락) -> false", () => {
  const stats = completeStats().slice(0, 9);
  assert.equal(hasCompletePlayerStats(stats, BLUE, RED), false);
});

test("hasCompletePlayerStats: 포지션 중복(TOP 2명, SUP 없음) -> false", () => {
  const stats = completeStats();
  stats[4] = { ...stats[4], position: "TOP" }; // blue SUP 자리를 TOP으로 중복시킴
  assert.equal(hasCompletePlayerStats(stats, BLUE, RED), false);
});

test("hasCompletePlayerStats: 선수 중복(동일 playerId 두 번) -> false", () => {
  const stats = completeStats();
  stats[1] = { ...stats[1], playerId: stats[0].playerId };
  assert.equal(hasCompletePlayerStats(stats, BLUE, RED), false);
});

test("hasCompletePlayerStats: 팀 쏠림(블루 6명, 레드 4명) -> false", () => {
  const stats = completeStats();
  stats[5] = { ...stats[5], teamId: BLUE };
  assert.equal(hasCompletePlayerStats(stats, BLUE, RED), false);
});

test("hasCompletePlayerStats: 팀 정보 없으면 -> false", () => {
  assert.equal(hasCompletePlayerStats(completeStats(), null, RED), false);
});
