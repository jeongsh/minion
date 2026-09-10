import test from "node:test";
import assert from "node:assert/strict";
import { workflowHealth, type SocialWorkflowRun } from "./social-health.ts";
import { retryFetch } from "./retry-fetch.ts";

const now = Date.parse("2026-09-10T12:00:00Z");
const policy = { maximumAgeHours: 1.5, maximumRunMinutes: 20 };
function run(minutes: number, conclusion: string | null = "success", status = "completed"): SocialWorkflowRun {
  const time = new Date(now - minutes * 60_000).toISOString();
  return { id: minutes, status, conclusion, created_at: time, updated_at: time, html_url: "https://example.com/run" };
}
test("healthy collection, failed latest run, missing schedule, and stalled runner are distinct", () => {
  assert.equal(workflowHealth(policy, [run(10)], now), "healthy");
  assert.equal(workflowHealth(policy, [run(10, "failure"), run(20)], now), "failed");
  assert.equal(workflowHealth(policy, [run(100)], now), "stale");
  assert.equal(workflowHealth(policy, [], now), "missing");
  assert.equal(workflowHealth(policy, [run(30, null, "queued"), run(35)], now), "stalled");
  assert.equal(workflowHealth(policy, [run(1, null, "in_progress"), run(10)], now), "healthy");
});
test("transient upstream outage retries once and can recover", async () => {
  let calls = 0;
  const result = await retryFetch("https://example.com", {}, { fetchImpl: async () => new Response("", { status: ++calls === 1 ? 503 : 200 }), sleep: async () => {} });
  assert.equal(calls, 2);
  assert.equal(result.status, 200);
});
test("authentication errors and long rate-limit cooldowns are not retried", async () => {
  for (const status of [403, 429]) {
    let calls = 0;
    const result = await retryFetch("https://example.com", {}, { fetchImpl: async () => { calls++; return new Response("", { status, headers: { "retry-after": "120" } }); }, sleep: async () => { assert.fail("must honor cooldown"); } });
    assert.equal(result.status, status);
    assert.equal(calls, 1);
  }
});
