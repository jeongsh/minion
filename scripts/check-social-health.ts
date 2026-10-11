import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SOCIAL_WORKFLOWS, unresolvedIncident, workflowHealth, type FailureIncident, type SocialWorkflowRun } from "../lib/sync/social-health.ts";
import { retryFetch } from "../lib/sync/retry-fetch.ts";

const statePath = "artifacts/social-monitor-state.json";
const reportPath = "artifacts/social-health.json";
type MonitorState = { version: 2; incidents: Record<string, FailureIncident> };

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const webhook = process.env.DISCORD_SOCIAL_WEBHOOK_URL;
  if (!repository || !token) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required.");
  if (!webhook) throw new Error("DISCORD_SOCIAL_WEBHOOK_URL is required for incident alerts.");
  const state: MonitorState = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8")) as MonitorState
    : { version: 2, incidents: {} };
  // Never silently discard corrupt state and resend every active incident.
  if (state.version !== 2 || !state.incidents || Object.values(state.incidents).some((incident) =>
    !incident || !Number.isFinite(incident.startedAt) || typeof incident.alerted !== "boolean")) {
    throw new Error("Invalid incident state; refusing to resend alerts.");
  }
  const now = Date.now();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
  const workflowsResponse = await retryFetch(`https://api.github.com/repos/${repository}/actions/workflows?per_page=100`, { headers });
  if (!workflowsResponse.ok) throw new Error(`Cannot verify enabled workflows (${workflowsResponse.status})`);
  const workflows = await workflowsResponse.json() as { workflows: { path: string; state: string }[] };
  if (!Array.isArray(workflows.workflows)) throw new Error("Invalid workflow list");
  const disabled = new Set(workflows.workflows.filter((workflow) => workflow.state.startsWith("disabled")).map((workflow) => workflow.path.split("/").at(-1)));
  const results = [];
  const alerts = [];
  for (const workflow of SOCIAL_WORKFLOWS) {
    if (disabled.has(workflow.file)) {
      delete state.incidents[workflow.file];
      continue;
    }
    // The transfer schedule intentionally stops outside the offseason.
    if (workflow.activeMonths && !workflow.activeMonths.includes(new Date(now).getUTCMonth() + 1)) continue;
    const url = `https://api.github.com/repos/${repository}/actions/workflows/${workflow.file}/runs?branch=${workflow.branch ?? "main"}&per_page=100`;
    let runs: SocialWorkflowRun[] = [];
    let status = "unavailable";
    try {
      const response = await retryFetch(url, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as { workflow_runs: SocialWorkflowRun[] };
      if (!Array.isArray(body.workflow_runs)) throw new Error("Invalid workflow response");
      runs = body.workflow_runs;
      status = workflowHealth(workflow, runs, now);
    } catch {
      console.error(`[error] Cannot verify workflow status: ${workflow.file}`);
    }
    let previous: FailureIncident | undefined = state.incidents[workflow.file];
    const startedAt = previous?.startedAt ?? Infinity;
    // A recovery and another failure can both happen between monitor checks.
    if (runs.some((run) => run.conclusion === "success" && Date.parse(run.updated_at) > startedAt)) {
      previous = undefined;
    }
    const { incident, alert } = unresolvedIncident(previous, status, now);
    if (incident) state.incidents[workflow.file] = incident;
    else delete state.incidents[workflow.file];
    const completed = runs.find((run) => run.status === "completed" && !["cancelled", "skipped", "neutral"].includes(run.conclusion ?? ""));
    const result = { name: workflow.name, workflow: workflow.file, status, runUrl: completed?.html_url ?? `https://github.com/${repository}/actions/workflows/${workflow.file}`, lastRunAt: runs[0]?.created_at ?? null };
    results.push(result);
    if (alert) alerts.push(result);
  }
  mkdirSync(dirname(reportPath), { recursive: true });
  const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
  // Preserve pending incidents even if delivery fails. Mark alerted only on success.
  saveState();
  writeFileSync(reportPath, JSON.stringify({ checkedAt: new Date(now).toISOString(), results }, null, 2));
  const summary = results.map((result) => `- ${result.name}: ${result.status} ${result.runUrl}`).join("\n");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Workflow health\n\n${summary}\n`);
  for (const result of alerts) {
    const response = await retryFetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "미니언 장애 알림", allowed_mentions: { parse: [] }, content: `**${result.name}: 복구되지 않은 장애**\n1시간 뒤 재확인해도 정상으로 돌아오지 않았습니다.\n상태: ${result.status}\n${result.runUrl}` }),
    }, { retries: 0 });
    if (!response.ok) throw new Error(`Incident alert delivery failed (${response.status})`);
    state.incidents[result.workflow].alerted = true;
    saveState();
  }
  // Collector workflows retain their real failure status. A healthy monitor
  // reports ongoing incidents without failing again or sending recovery alerts.
  for (const result of results.filter((result) => result.status !== "healthy")) {
    console.log(`::warning::${result.name}: ${result.status} (${result.runUrl})`);
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Workflow health check failed"); process.exitCode = 1; });
