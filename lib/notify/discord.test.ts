import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sendDiscordCommunityModerationAlert,
  sendDiscordMatchAutomationAlert,
} from "./discord.ts";

test("커뮤니티 모더레이션 알림: 정화봇 차단 이벤트를 렌더링한다", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordCommunityModerationAlert(
      "https://discord.example/webhook",
      {
        kind: "ai_blind",
        targetType: "post",
        summary: "광고 글 제목",
        reason: "광고·홍보 — 외부 유입 유도",
        postPath: "/community/post/abc",
        botName: "정화봇",
      },
      "https://example.com/",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  const body = requestBodies[0]!;
  assert.equal(body.username, "정화봇");
  const embed = (body.embeds as Array<{ title: string; description: string; url: string }>)[0]!;
  assert.equal(embed.title, "정화봇 차단: 게시글");
  assert.equal(embed.url, "https://example.com/community/post/abc");
  assert.match(embed.description, /광고 글 제목/);
  assert.match(embed.description, /사유: 광고·홍보 — 외부 유입 유도/);
  assert.match(embed.description, /admin\/community/);
});

test("커뮤니티 모더레이션 알림: 신고 누적 이벤트는 신고 수를 표기한다", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordCommunityModerationAlert("https://discord.example/webhook", {
      kind: "report_blind",
      targetType: "comment",
      summary: "문제의 댓글 내용",
      reportCount: 3,
      postPath: "/community/post/abc",
      botName: "신고 알림",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const embed = (requestBodies[0]!.embeds as Array<{ title: string; description: string }>)[0]!;
  assert.equal(embed.title, "신고 누적 블라인드: 댓글");
  assert.match(embed.description, /서로 다른 이용자 신고 3건 누적/);
});

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

test("normalizes bare site URLs in match automation links", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    await sendDiscordMatchAutomationAlert(
      "https://discord.example/webhook",
      {
        eventType: "set_rating_opened",
        matchId: "match-1",
        matchName: "MSI 2026",
        setNumber: 2,
        teamAScore: 1,
        teamBScore: 0,
      },
      "lckhub.example/",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  const embed = (requestBodies[0]!.embeds as Array<{ url: string }>)[0];
  assert.equal(embed.url, "https://lckhub.example/matches/match-1?tab=rating&set=2");
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
