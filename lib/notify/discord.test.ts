import assert from "node:assert/strict";
import { test } from "node:test";

import { sendDiscordMatchAutomationAlert } from "./discord.ts";

test("renders set data sync success details", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordMatchAutomationAlert("https://discord.example/webhook", {
      eventType: "set_data_sync_succeeded",
      matchId: "match-1",
      matchName: "MSI 2026",
      setNumber: 2,
      teamAScore: 2,
      teamBScore: 0,
      playerStatsUpserted: 10,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const embed = (requestBodies[0]!.embeds as Array<{ title: string; description: string }>)[0];
  assert.equal(embed.title, "Set 2 전체 데이터 동기화 성공");
  assert.match(embed.description, /선수 데이터 10\/10명 저장/);
});

test("renders Leaguepedia rate limit and retry notice", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordMatchAutomationAlert("https://discord.example/webhook", {
      eventType: "set_data_sync_rate_limited",
      matchId: "match-1",
      matchName: "MSI 2026",
      setNumber: 2,
      teamAScore: 2,
      teamBScore: 0,
      error: "Leaguepedia rate limit",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const embed = (requestBodies[0]!.embeds as Array<{ title: string; description: string }>)[0];
  assert.equal(embed.title, "Set 2 Leaguepedia 레이트 리밋");
  assert.match(embed.description, /10분 후 자동으로 다시 시도/);
});

test("renders set data sync failure reason", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordMatchAutomationAlert("https://discord.example/webhook", {
      eventType: "set_data_sync_failed",
      matchId: "match-1",
      matchName: "MSI 2026",
      setNumber: 2,
      teamAScore: 2,
      teamBScore: 0,
      error: "mapped 8/10 players",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  const embed = (requestBodies[0]!.embeds as Array<{ title: string; description: string }>)[0];
  assert.equal(embed.title, "Set 2 데이터 동기화 실패");
  assert.match(embed.description, /mapped 8\/10 players/);
});
