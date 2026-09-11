import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SOCIAL_WORKFLOWS, shouldAlertSocialFailure, workflowHealth, type SocialWorkflowRun } from "../lib/sync/social-health.ts";
import { retryFetch } from "../lib/sync/retry-fetch.ts";

const statePath = "artifacts/social-monitor-state.json";
const reportPath = "artifacts/social-health.json";

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required.");
  let previous: Record<string, string> = {};
  try { previous = JSON.parse(readFileSync(statePath, "utf8")); } catch { /* First check. */ }
  const statuses: Record<string, string> = {};
  const results = [];
  for (const workflow of SOCIAL_WORKFLOWS) {
    const url = `https://api.github.com/repos/${repository}/actions/workflows/${workflow.file}/runs?branch=main&per_page=20`;
    let runs: SocialWorkflowRun[] = [];
    let status = "unavailable";
    try {
      const response = await retryFetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { workflow_runs: SocialWorkflowRun[] };
      if (!Array.isArray(body.workflow_runs)) throw new Error("Invalid workflow response");
      runs = body.workflow_runs;
      status = workflowHealth(workflow, runs);
    } catch {
      console.error(`[error] Cannot verify workflow status: ${workflow.file}`);
    }
    statuses[workflow.file] = status;
    results.push({ name: workflow.name, workflow: workflow.file, status, runUrl: runs[0]?.html_url ?? `https://github.com/${repository}/actions/workflows/${workflow.file}`, lastRunAt: runs[0]?.created_at ?? null });
  }
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  const summary = results.map((result) => `- ${result.name}: ${result.status} ${result.runUrl}`).join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Social collection health\n\n${summary}\n`);
  const changed = results.filter((result) => shouldAlertSocialFailure(previous[result.workflow], result.status));
  const webhook = process.env.DISCORD_SOCIAL_WEBHOOK_URL;
  if (webhook && changed.length) {
    const labels: Record<string, string> = { failed: "수집 실패", stale: "정상 수집 장시간 없음", stalled: "실행 지연·중단", missing: "실행 기록 없음", unavailable: "감시 API 확인 실패" };
    const response = await retryFetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "미니언 연결 알림", allowed_mentions: { parse: [] }, content: changed.map((r) => `${r.name}: **${labels[r.status] ?? r.status}**\n연결을 확인하고 다시 연결해 주세요.\n${r.runUrl}`).join("\n\n") }),
    });
    if (!response.ok) throw new Error(`Social alert delivery failed (${response.status})`);
  }
  writeFileSync(statePath, JSON.stringify(statuses, null, 2));
  if (results.some((result) => result.status !== "healthy")) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Social health check failed"); process.exitCode = 1; });
