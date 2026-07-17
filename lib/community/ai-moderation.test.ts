import assert from "node:assert/strict";
import { test } from "node:test";

import { screenCommunityText } from "./ai-moderation.ts";

type FetchCall = { url: string; body: Record<string, unknown> };

function mockFetch(handler: (url: string) => Response | Promise<Response>): {
  calls: FetchCall[];
  restore: () => void;
} {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return handler(url);
  };
  return { calls, restore: () => { globalThis.fetch = originalFetch; } };
}

function moderationResponse(flagged: boolean): Response {
  return new Response(
    JSON.stringify({
      results: [
        {
          flagged,
          categories: { hate: flagged },
          category_scores: { hate: flagged ? 0.91 : 0.01 },
        },
      ],
    }),
    { status: 200 },
  );
}

function spamResponse(verdict: "ad" | "gambling" | "normal"): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: JSON.stringify({ verdict, reason: "테스트 사유" }) },
          ],
        },
      ],
    }),
    { status: 200 },
  );
}

test("모더레이션 API가 걸면 카테고리와 함께 위반 판정한다", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const { calls, restore } = mockFetch(() => moderationResponse(true));
  try {
    const verdict = await screenCommunityText({ title: "제목", text: "본문" });
    assert.deepEqual(verdict, { flagged: true, category: "혐오 표현", detail: "모더레이션 점수 91%" });
    // 1단계에서 걸리면 2단계(스팸 분류)는 호출하지 않는다.
    assert.equal(calls.length, 1);
    assert.match(calls[0]!.url, /moderations/);
  } finally {
    restore();
  }
});

test("모더레이션 통과 + 광고 판정이면 광고로 위반 처리한다", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const { calls, restore } = mockFetch((url) =>
    url.includes("moderations") ? moderationResponse(false) : spamResponse("ad"),
  );
  try {
    const verdict = await screenCommunityText({ text: "최저가 구매 링크 클릭" });
    assert.deepEqual(verdict, { flagged: true, category: "광고·홍보", detail: "테스트 사유" });
    assert.equal(calls.length, 2);
  } finally {
    restore();
  }
});

test("둘 다 통과하면 정상 판정한다", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const { restore } = mockFetch((url) =>
    url.includes("moderations") ? moderationResponse(false) : spamResponse("normal"),
  );
  try {
    assert.deepEqual(await screenCommunityText({ text: "오늘 경기 재밌었다" }), { flagged: false });
  } finally {
    restore();
  }
});

test("API 장애 시 fail-open(정상 판정)한다", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const { restore } = mockFetch(() => new Response("oops", { status: 500 }));
  try {
    assert.deepEqual(await screenCommunityText({ text: "아무 글" }), { flagged: false });
  } finally {
    restore();
  }
});

test("API 키가 없으면 검수를 건너뛴다", async () => {
  delete process.env.OPENAI_API_KEY;
  const { calls, restore } = mockFetch(() => moderationResponse(true));
  try {
    assert.deepEqual(await screenCommunityText({ text: "아무 글" }), { flagged: false });
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});
