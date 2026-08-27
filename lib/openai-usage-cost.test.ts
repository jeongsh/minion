import assert from "node:assert/strict";
import { test } from "node:test";

import {
  combineOpenAiUsage,
  measureOpenAiResponseUsage,
} from "./openai-usage-cost.ts";

test("캐시 토큰과 웹 검색 호출을 분리해 비용을 계산한다", () => {
  const usage = measureOpenAiResponseUsage({
    usage: {
      input_tokens: 1_000,
      input_tokens_details: { cached_tokens: 100 },
      output_tokens: 500,
      output_tokens_details: { reasoning_tokens: 200 },
      total_tokens: 1_500,
    },
    output: [
      { type: "web_search_call" },
      { type: "message" },
      { type: "web_search_call" },
    ],
  }, "gpt-5.4-mini");

  assert.equal(usage.webSearchCalls, 2);
  assert.equal(usage.reasoningTokens, 200);
  assert.ok(Math.abs((usage.estimatedCostUsd ?? 0) - 0.0229325) < 1e-10);
});

test("reasoning 토큰은 output 토큰에 포함되어 중복 과금하지 않는다", () => {
  const withoutReasoning = measureOpenAiResponseUsage({
    usage: { input_tokens: 1_000, output_tokens: 1_000, total_tokens: 2_000 },
  }, "gpt-5.6-sol");
  const withReasoning = measureOpenAiResponseUsage({
    usage: {
      input_tokens: 1_000,
      output_tokens: 1_000,
      output_tokens_details: { reasoning_tokens: 900 },
      total_tokens: 2_000,
    },
  }, "gpt-5.6-sol");

  assert.equal(withReasoning.estimatedCostUsd, withoutReasoning.estimatedCostUsd);
});

test("알 수 없는 모델은 토큰은 기록하되 추정 비용은 만들지 않는다", () => {
  const unknown = measureOpenAiResponseUsage({
    usage: { input_tokens: 12, output_tokens: 3, total_tokens: 15 },
  }, "custom-preview-model");
  const combined = combineOpenAiUsage([
    unknown,
    measureOpenAiResponseUsage({ usage: { input_tokens: 1 } }, "gpt-5.4-mini"),
  ]);

  assert.equal(unknown.inputTokens, 12);
  assert.equal(unknown.estimatedCostUsd, null);
  assert.equal(combined.estimatedCostUsd, null);
});
