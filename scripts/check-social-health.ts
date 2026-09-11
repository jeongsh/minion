import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SOCIAL_WORKFLOWS, connectionState, hasConnectionFailure, shouldAlertSocialFailure, workflowHealth, type SocialWorkflowRun } from "../lib/sync/social-health.ts";
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
    let disconnected = false;
    const completed = runs.find((run) => run.status === "completed");
    if (completed?.conclusion === "failure" && workflow.file !== "renew-youtube-websub.yml") {
      try {
        const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
        const jobsResponse = await retryFetch(`https://api.github.com/repos/${repository}/actions/runs/${completed.id}/jobs?per_page=100`, { headers });
        if (!jobsResponse.ok) throw new Error("Cannot read collection jobs");
        const jobs = await jobsResponse.json() as { jobs: { id: number; conclusion: string | null }[] };
        for (const job of jobs.jobs.filter((job) => job.conclusion === "failure")) {
          const logs = await retryFetch(`https://api.github.com/repos/${repository}/actions/jobs/${job.id}/logs`, { headers });
          if (!logs.ok) throw new Error("Cannot read collection logs");
          disconnected ||= hasConnectionFailure(workflow.file, await logs.text());
        }
      } catch {
        console.error(`[error] Cannot verify connection failure: ${workflow.file}`);
      }
    }
    statuses[workflow.file] = connectionState(previous[workflow.file], status, disconnected);
    results.push({ name: workflow.name, workflow: workflow.file, status, disconnected, runUrl: completed?.html_url ?? `https://github.com/${repository}/actions/workflows/${workflow.file}`, lastRunAt: runs[0]?.created_at ?? null });
  }
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  const summary = results.map((result) => `- ${result.name}: ${result.status} ${result.runUrl}`).join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Social collection health\n\n${summary}\n`);
  const changed = results.filter((result) => result.disconnected && shouldAlertSocialFailure(previous[result.workflow], statuses[result.workflow]));
  const webhook = process.env.DISCORD_SOCIAL_WEBHOOK_URL;
  if (webhook && changed.length) {
    const response = await retryFetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "미니언 연결 알림", allowed_mentions: { parse: [] }, content: changed.map((r) => `${r.name}: **연결 인증 실패**\n인증을 확인하고 다시 연결해 주세요.\n${r.runUrl}`).join("\n\n") }),
    });
    if (!response.ok) throw new Error(`Social alert delivery failed (${response.status})`);
  }
  writeFileSync(statePath, JSON.stringify(statuses, null, 2));
  if (results.some((result) => result.status !== "healthy")) process.exitCode = 1;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Social health check failed"); process.exitCode = 1; });
