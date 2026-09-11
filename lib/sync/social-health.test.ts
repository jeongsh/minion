import test from "node:test";
import assert from "node:assert/strict";
import { connectionState, hasConnectionFailure, shouldAlertSocialFailure, workflowHealth, type SocialWorkflowRun } from "./social-health.ts";
import { retryFetch } from "./retry-fetch.ts";

const now = Date.parse("2026-09-10T12:00:00Z");
const policy = { maximumAgeHours: 1.5, maximumRunMinutes: 20 };
test("alerts once per failure incident and silently rearms after recovery", () => {
  const states = ["healthy", "disconnected", "disconnected", "disconnected", "disconnected", "healthy", "healthy", "disconnected"];
  let previous: string | undefined;
  assert.deepEqual(states.map((current) => {
    const alert = shouldAlertSocialFailure(previous, current);
    previous = current;
    return alert;
  }), [false, true, false, false, false, false, false, true]);
  assert.equal(shouldAlertSocialFailure(undefined, "disconnected"), true);
});

test("missing activity and generic failures never request reconnection", () => {
  for (const status of ["healthy", "stale", "stalled", "missing", "unavailable", "failed"]) {
    assert.equal(shouldAlertSocialFailure(undefined, status), false);
    assert.equal(connectionState("disconnected", status, false), status === "healthy" ? "healthy" : "disconnected");
  }
});

test("only explicit provider authentication errors qualify", () => {
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[error] team:HLE posts — INSTAGRAM_LOGIN: @hle; login session expired or login required"), true);
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[error] INSTAGRAM_CHALLENGE: @hle; account verification required"), true);
  assert.equal(hasConnectionFailure("sync-youtube.yml", "[error] team:HLE API key not valid. Please pass a valid API key."), true);
  for (const error of ["INSTAGRAM_EMPTY", "INSTAGRAM_HTTP_403", "INSTAGRAM_HTTP_429", "INSTAGRAM_HTTP_503", "INSTAGRAM_LOGIN: @hle; pagination rejected", "checked=0", "quotaExceeded", "timeout"]) {
    for (const workflow of ["sync-instagram.yml", "sync-youtube.yml", "renew-youtube-websub.yml"]) {
      assert.equal(hasConnectionFailure(workflow, `[error] ${error}`), false);
    }
  }
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[retry] INSTAGRAM_LOGIN: @hle; login session expired or login required"), false);
});
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
