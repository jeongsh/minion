export type SocialWorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  run_started_at?: string;
  updated_at: string;
  html_url: string;
};

export const SOCIAL_WORKFLOWS: readonly { file: string; name: string; maximumAgeHours: number; maximumRunMinutes: number; ignoreScheduleDelay?: boolean; branch?: string; activeMonths?: number[] }[] = [
  { file: "sync-youtube.yml", name: "YouTube API", maximumAgeHours: Infinity, maximumRunMinutes: 20, ignoreScheduleDelay: true },
  { file: "renew-youtube-websub.yml", name: "YouTube WebSub", maximumAgeHours: 36, maximumRunMinutes: 20 },
  { file: "sync-instagram.yml", name: "Instagram", maximumAgeHours: 30, maximumRunMinutes: 40 },
  { file: "sync-leaguepedia-incremental.yml", name: "Leaguepedia", maximumAgeHours: 36, maximumRunMinutes: 40 },
  { file: "sync-transfers.yml", name: "LCK 이적 동기화", maximumAgeHours: 2, maximumRunMinutes: 10, activeMonths: [1, 2, 9, 10, 11, 12] },
  { file: "pr-quality.yml", name: "PR 검사", maximumAgeHours: Infinity, maximumRunMinutes: 30 },
  { file: "generate-weekly-report.yml", name: "주간 리포트", maximumAgeHours: 192, maximumRunMinutes: 40 },
  { file: "check-instagram-session.yml", name: "Instagram 인증 검사", maximumAgeHours: Infinity, maximumRunMinutes: 20 },
  { file: "lolesports-api-smoke.yml", name: "LoL Esports API 검사", maximumAgeHours: Infinity, maximumRunMinutes: 10 },
  { file: "mirror-to-personal.yml", name: "개인 저장소 동기화", maximumAgeHours: Infinity, maximumRunMinutes: 60, branch: "dev" },
];

export type FailureIncident = { startedAt: number; alerted: boolean };
export const FAILURE_CONFIRMATION_MS = 60 * 60_000;

/** All unhealthy states belong to one incident until a successful recovery. */
export function unresolvedIncident(previous: FailureIncident | undefined, health: string, now = Date.now()) {
  if (health === "healthy") return { incident: undefined, alert: false };
  const incident = previous ?? { startedAt: now, alerted: false };
  return { incident, alert: !incident.alerted && now - incident.startedAt >= FAILURE_CONFIRMATION_MS };
}

export function shouldAlertSocialFailure(previous: string | undefined, current: string) {
  return current === "disconnected" && previous !== "disconnected";
}

export function isNewSocialIncident(previous: string | undefined, current: string) {
  return current !== "healthy" && (previous === undefined || previous === "healthy");
}

export function hasConnectionFailure(workflow: string, logs: string) {
  const errors = logs.split(/\r?\n/).filter((line) => line.includes("[error]"));
  if (workflow === "sync-instagram.yml") {
    return errors.some((line) => /INSTAGRAM_SESSION_REJECTED:|INSTAGRAM_SESSION_CHALLENGE:/.test(line));
  }
  if (workflow === "sync-youtube.yml") {
    return errors.some((line) => /API key not valid|API key expired|API_KEY_INVALID|API_KEY_EXPIRED|invalid authentication credentials|invalid_grant|UNAUTHENTICATED/i.test(line));
  }
  return false;
}

export function connectionState(previous: string | undefined, health: string, disconnected: boolean) {
  if (disconnected) return "disconnected";
  if (health === "healthy") return "healthy";
  return previous === "disconnected" ? "disconnected" : "unknown";
}

export function workflowHealth(
  workflow: { maximumAgeHours: number; maximumRunMinutes: number; ignoreScheduleDelay?: boolean },
  runs: SocialWorkflowRun[],
  now = Date.now(),
) {
  const latest = runs[0];
  if (!latest) return Number.isFinite(workflow.maximumAgeHours) ? "missing" : "healthy";
  const startedAt = workflow.ignoreScheduleDelay ? latest.run_started_at ?? latest.updated_at : latest.created_at;
  if (latest.status !== "completed" && !(workflow.ignoreScheduleDelay && ["queued", "waiting", "requested", "pending"].includes(latest.status)) && now - Date.parse(startedAt) > workflow.maximumRunMinutes * 60_000) return "stalled";
  const completed = runs.find((run) => run.status === "completed" && !["cancelled", "skipped", "neutral"].includes(run.conclusion ?? ""));
  if (completed && completed.conclusion !== "success") return "failed";
  if (!Number.isFinite(workflow.maximumAgeHours)) return "healthy";
  const success = runs.find((run) => run.conclusion === "success");
  if (!success || now - Date.parse(success.updated_at) > workflow.maximumAgeHours * 3_600_000) return "stale";
  return "healthy";
}
