export type SocialWorkflowRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};

export const SOCIAL_WORKFLOWS = [
  { file: "sync-youtube.yml", name: "YouTube API", maximumAgeHours: 1.5, maximumRunMinutes: 20 },
  { file: "renew-youtube-websub.yml", name: "YouTube WebSub", maximumAgeHours: 36, maximumRunMinutes: 20 },
  { file: "sync-instagram.yml", name: "Instagram", maximumAgeHours: 30, maximumRunMinutes: 40 },
] as const;

export function workflowHealth(
  workflow: { maximumAgeHours: number; maximumRunMinutes: number },
  runs: SocialWorkflowRun[],
  now = Date.now(),
) {
  const latest = runs[0];
  if (!latest) return "missing";
  if (latest.status !== "completed" && now - Date.parse(latest.created_at) > workflow.maximumRunMinutes * 60_000) return "stalled";
  const completed = runs.find((run) => run.status === "completed");
  if (completed && completed.conclusion !== "success") return "failed";
  const success = runs.find((run) => run.conclusion === "success");
  if (!success || now - Date.parse(success.updated_at) > workflow.maximumAgeHours * 3_600_000) return "stale";
  return "healthy";
}
