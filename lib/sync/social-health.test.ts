import test from "node:test";
import assert from "node:assert/strict";
import { SOCIAL_WORKFLOWS, connectionState, hasConnectionFailure, shouldAlertSocialFailure, unresolvedIncident, FAILURE_CONFIRMATION_MS, workflowHealth, type SocialWorkflowRun } from "./social-health.ts";
import { retryFetch } from "./retry-fetch.ts";
import { instagramStopReason } from "../scraper/instagram-failure.ts";

const now = Date.parse("2026-09-10T12:00:00Z");
const policy = { maximumAgeHours: 1.5, maximumRunMinutes: 20 };

test("only an unresolved incident is alerted once, despite changes in failure type", () => {
  const first = unresolvedIncident(undefined, "failed", now);
  assert.equal(first.alert, false);
  assert.equal(unresolvedIncident(first.incident, "failed", now + FAILURE_CONFIRMATION_MS - 1).alert, false);
  const confirmed = unresolvedIncident(first.incident, "stale", now + FAILURE_CONFIRMATION_MS);
  assert.equal(confirmed.alert, true);
  const delivered = { ...confirmed.incident!, alerted: true };
  for (const status of ["failed", "stale", "stalled", "missing", "unavailable"]) {
    assert.equal(unresolvedIncident(delivered, status, now + 7 * 24 * FAILURE_CONFIRMATION_MS).alert, false);
  }
  const recovery = unresolvedIncident(delivered, "healthy", now + 8 * FAILURE_CONFIRMATION_MS);
  assert.equal(recovery.incident, undefined);
  assert.equal(recovery.alert, false);
  const next = unresolvedIncident(recovery.incident, "failed", now + 9 * FAILURE_CONFIRMATION_MS);
  assert.equal(next.alert, false);
  assert.equal(unresolvedIncident(next.incident, "failed", now + 10 * FAILURE_CONFIRMATION_MS).alert, true);
});

test("a failure recovered during the confirmation window never alerts", () => {
  const first = unresolvedIncident(undefined, "failed", now);
  assert.deepEqual(unresolvedIncident(first.incident, "healthy", now + 30 * 60_000), { incident: undefined, alert: false });
});

test("optional workflows do not alert before their first run or on cancellation", () => {
  const optional = { maximumAgeHours: Infinity, maximumRunMinutes: 30 };
  assert.equal(workflowHealth(optional, [], now), "healthy");
  assert.equal(workflowHealth(optional, [run(10, "cancelled"), run(20)], now), "healthy");
  assert.equal(workflowHealth(optional, [run(10, "failure"), run(20)], now), "failed");
});
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
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[error] team:HLE posts — INSTAGRAM_SESSION_REJECTED: @hle; saved session requires login"), true);
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[error] INSTAGRAM_SESSION_CHALLENGE: @hle; account verification required"), true);
  assert.equal(hasConnectionFailure("sync-youtube.yml", "[error] team:HLE API key not valid. Please pass a valid API key."), true);
  for (const error of ["INSTAGRAM_EMPTY", "INSTAGRAM_HTTP_401", "INSTAGRAM_HTTP_403", "INSTAGRAM_HTTP_429", "INSTAGRAM_HTTP_503", "INSTAGRAM_LOGIN_REQUIRED: @hle; public profile requires login", "INSTAGRAM_CHALLENGE: @hle; account verification required", "INSTAGRAM_LOGIN: @hle; login session expired or login required", "INSTAGRAM_LOGIN: @hle; pagination rejected", "checked=0", "quotaExceeded", "timeout"]) {
    for (const workflow of ["sync-instagram.yml", "sync-youtube.yml", "renew-youtube-websub.yml"]) {
      assert.equal(hasConnectionFailure(workflow, `[error] ${error}`), false);
    }
  }
  assert.equal(hasConnectionFailure("sync-instagram.yml", "[recovery] INSTAGRAM_SESSION_REJECTED: @hle; saved session requires login"), false);
});

test("rate limits and verification stop immediately; repeated access failures stop after three", () => {
  assert.match(instagramStopReason("INSTAGRAM_HTTP_429: @t1lol; Retry-After=120", 0)!, /rate limit/);
  assert.match(instagramStopReason("INSTAGRAM_SESSION_CHALLENGE: @t1lol", 0)!, /verification/);
  for (const code of ["SESSION_REJECTED", "LOGIN_REQUIRED", "HTTP_401", "HTTP_403", "EMPTY"]) {
    assert.equal(instagramStopReason(`INSTAGRAM_${code}: @t1lol`, 2), null);
    assert.match(instagramStopReason(`INSTAGRAM_${code}: @t1lol`, 3)!, /Three consecutive/);
  }
  assert.equal(instagramStopReason("Database connection failed", 3), null);
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

test("YouTube schedule delays stay quiet while real failures remain unhealthy", () => {
  const youtube = SOCIAL_WORKFLOWS.find(item => item.file === "sync-youtube.yml")!;
  assert.equal(workflowHealth(youtube, [run(600)], now), "healthy");
  assert.equal(workflowHealth(youtube, [], now), "healthy");
  assert.equal(workflowHealth(youtube, [run(120, null, "queued"), run(600)], now), "healthy");
  assert.equal(workflowHealth(youtube, [run(120, null, "queued"), run(600, "failure")], now), "failed");
  assert.equal(workflowHealth(youtube, [run(120, "failure")], now), "failed");
  assert.equal(workflowHealth(youtube, [run(30, null, "in_progress")], now), "stalled");
  assert.equal(workflowHealth(youtube, [{ ...run(120, null, "in_progress"), run_started_at: new Date(now - 60_000).toISOString() }], now), "healthy");
  const oldIncident = { startedAt: now - FAILURE_CONFIRMATION_MS, alerted: true };
  assert.equal(unresolvedIncident(oldIncident, workflowHealth(youtube, [run(600)], now), now).incident, undefined);
});
