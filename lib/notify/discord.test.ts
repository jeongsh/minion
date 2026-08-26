import assert from "node:assert/strict";
import { test } from "node:test";

import {
  sendDiscordFanCalendarSubmissionAlert,
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

test("팬 일정 제보 알림에 출처와 관리자 검토 링크를 담는다", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response("{}", { status: 200 });
  };
  try {
    const result = await sendDiscordFanCalendarSubmissionAlert(
      "https://discord.example/webhook",
      {
        submissionId: "11111111-2222-3333-4444-555555555555",
        teamName: "T1",
        teamSlug: "t1",
        requesterName: "미니언",
        eventTypeLabel: "일정·이벤트",
        title: "팬 미팅",
        eventDate: "2026-09-01",
        eventTime: "18:30",
        isRecurring: false,
        description: "공개 방송 이후 진행",
        sourceUrl: "https://example.com/events/1",
        pendingCount: 2,
      },
      "https://minion.example/",
    );
    assert.deepEqual(result, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const body = requestBodies[0]!;
  assert.equal(body.username, "일정 제보 알림");
  assert.deepEqual(body.allowed_mentions, { parse: [] });
  const embed = (body.embeds as Array<{ title: string; description: string; url: string }>)[0]!;
  assert.equal(embed.title, "일정 제보: 팬 미팅");
  assert.equal(embed.url, "https://minion.example/admin/calendar#calendar-submissions");
  assert.match(embed.description, /2026-09-01 18:30/);
  assert.match(embed.description, /https:\/\/example\.com\/events\/1/);
  assert.match(embed.description, /미처리 제보 2건/);
});

test("팬 일정 제보 Discord 4xx 실패를 안전한 종료 코드로 반환한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("sensitive response body", { status: 404 });
  try {
    const result = await sendDiscordFanCalendarSubmissionAlert("https://discord.example/webhook", {
        submissionId: "11111111-2222-3333-4444-555555555555",
        teamName: "T1",
        teamSlug: "t1",
        requesterName: "미니언",
        eventTypeLabel: "일정·이벤트",
        title: "팬 미팅",
        eventDate: "2026-09-01",
        eventTime: null,
        isRecurring: false,
        description: null,
        sourceUrl: "https://example.com/events/1",
        pendingCount: 1,
      });
    assert.deepEqual(result, {
      ok: false,
      errorCode: "client_error",
      retryable: false,
      retryAfterSeconds: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("팬 일정 제보 Discord 429의 Retry-After를 반환한다", async () => {
  const result = await sendDiscordFanCalendarSubmissionAlert(
    "https://discord.example/webhook",
    {
      submissionId: "11111111-2222-3333-4444-555555555555",
      teamName: "T1",
      teamSlug: "t1",
      requesterName: "미니언",
      eventTypeLabel: "일정·이벤트",
      title: "팬 미팅",
      eventDate: "2026-09-01",
      eventTime: null,
      isRecurring: false,
      description: null,
      sourceUrl: "https://example.com/events/1",
      pendingCount: 1,
    },
    undefined,
    async () => new Response("ignored", {
      status: 429,
      headers: { "Retry-After": "12.4" },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    errorCode: "rate_limited",
    retryable: true,
    retryAfterSeconds: 13,
  });
});

test("팬 일정 제보 Discord 5xx를 재시도 가능한 안전 코드로 반환한다", async () => {
  const result = await sendDiscordFanCalendarSubmissionAlert(
    "https://discord.example/webhook",
    {
      submissionId: "11111111-2222-3333-4444-555555555555",
      teamName: "T1",
      teamSlug: "t1",
      requesterName: "미니언",
      eventTypeLabel: "일정·이벤트",
      title: "팬 미팅",
      eventDate: "2026-09-01",
      eventTime: null,
      isRecurring: false,
      description: null,
      sourceUrl: "https://example.com/events/1",
      pendingCount: 1,
    },
    undefined,
    async () => new Response("sensitive upstream failure", { status: 503 }),
  );

  assert.deepEqual(result, {
    ok: false,
    errorCode: "server_error",
    retryable: true,
    retryAfterSeconds: null,
  });
});

test("팬 일정 제보 Discord 네트워크·타임아웃 예외의 원문을 노출하지 않는다", async () => {
  const event = {
    submissionId: "11111111-2222-3333-4444-555555555555",
    teamName: "T1",
    teamSlug: "t1",
    requesterName: "미니언",
    eventTypeLabel: "일정·이벤트",
    title: "팬 미팅",
    eventDate: "2026-09-01",
    eventTime: null,
    isRecurring: false,
    description: null,
    sourceUrl: "https://example.com/events/1",
    pendingCount: 1,
  };
  const network = await sendDiscordFanCalendarSubmissionAlert(
    "https://discord.example/webhook",
    event,
    undefined,
    async () => { throw new Error("secret raw network error"); },
  );
  const timeout = await sendDiscordFanCalendarSubmissionAlert(
    "https://discord.example/webhook",
    event,
    undefined,
    async () => { throw new DOMException("secret raw timeout", "TimeoutError"); },
  );

  assert.deepEqual(network, {
    ok: false,
    errorCode: "network",
    retryable: true,
    retryAfterSeconds: null,
  });
  assert.deepEqual(timeout, {
    ok: false,
    errorCode: "timeout",
    retryable: true,
    retryAfterSeconds: null,
  });
});
