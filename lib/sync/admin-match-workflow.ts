const WORKFLOW = "admin-match-sync.yml";

export const REMOTE_MATCH_SCRIPTS = [
  "backfill-timeline-events",
  "backfill-leaguepedia-sets",
  "backfill-leaguepedia-set-ids",
  "sync-leaguepedia-lck",
  "sync-international-matches",
] as const;

const SEGMENTS = ["lck", "lck-cup", "first-stand", "msi", "ewc", "demacia-cup", "worlds", "enc", "kespa-cup", "international"];

export function matchWorkflowInputs(script: string, args: string[]) {
  if (!(REMOTE_MATCH_SCRIPTS as readonly string[]).includes(script)) throw new Error("지원하지 않는 경기 동기화입니다.");
  const inputs = { script, segment: "", year: "2026", force: "false", full: "false" };
  const seen = new Set<string>();
  for (const arg of args) {
    const key = arg.split("=")[0];
    if (seen.has(key)) throw new Error("중복된 인자입니다.");
    seen.add(key);
    if (arg === "--force" && script.startsWith("backfill-")) inputs.force = "true";
    else if (arg === "--full" && script.startsWith("sync-")) inputs.full = "true";
    else if (arg.startsWith("--segment=") && script.startsWith("backfill-") && SEGMENTS.includes(arg.slice(10))) inputs.segment = arg.slice(10);
    else if (/^--year=20\d{2}$/.test(arg) && script === "sync-leaguepedia-lck") inputs.year = arg.slice(7);
    else throw new Error("허용되지 않은 경기 동기화 인자입니다.");
  }
  return inputs;
}

async function github(path: string, init: RequestInit = {}) {
  const token = process.env.ADMIN_SCRIPTS_GITHUB_TOKEN;
  const repo = process.env.ADMIN_SCRIPTS_GITHUB_REPOSITORY;
  if (!token || !repo) throw new Error("운영서버에 ADMIN_SCRIPTS_GITHUB_TOKEN과 ADMIN_SCRIPTS_GITHUB_REPOSITORY 설정이 필요합니다.");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("GitHub 저장소 설정을 확인해주세요.");
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`GitHub 작업 요청 실패 (${response.status}). 저장소, 워크플로와 Actions 쓰기 권한을 확인해주세요.`);
  return response;
}

export async function dispatchMatchWorkflow(inputs: ReturnType<typeof matchWorkflowInputs>) {
  const response = await github(`workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: process.env.ADMIN_SCRIPTS_GITHUB_REF || "main", inputs, return_run_details: true }),
  });
  const run = await response.json() as { workflow_run_id: number; html_url: string };
  if (!Number.isSafeInteger(run.workflow_run_id)) throw new Error("실행 번호를 받지 못했습니다. GitHub Actions에서 실행 여부를 확인해주세요.");
  return { runId: run.workflow_run_id, url: run.html_url };
}

export async function getMatchWorkflow(runId: string) {
  if (!/^[1-9]\d{0,15}$/.test(runId)) throw new Error("잘못된 실행 번호입니다.");
  const response = await github(`runs/${runId}`);
  const run = await response.json() as { path: string; status: string; conclusion: string | null; html_url: string };
  // 다른 배포/관리 워크플로의 조회나 취소에는 사용할 수 없다.
  if (![`.github/workflows/${WORKFLOW}`, ".github/workflows/sync-instagram.yml"].includes(run.path.split("@")[0])) throw new Error("관리자 동기화 작업이 아닙니다.");
  return { runId: Number(runId), status: run.status, conclusion: run.conclusion, url: run.html_url };
}

export async function dispatchInstagramWorkflow(args: string[]) {
  if (args.length) throw new Error("인스타그램은 공식 API 기본 수집만 실행할 수 있습니다.");
  const response = await github("workflows/sync-instagram.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs: { scope: "all", no_notify: "true" }, return_run_details: true }),
  });
  const run = await response.json() as { workflow_run_id: number; html_url: string };
  if (!Number.isSafeInteger(run.workflow_run_id)) throw new Error("실행 번호를 받지 못했습니다. GitHub Actions에서 실행 여부를 확인해주세요.");
  return { runId: run.workflow_run_id, url: run.html_url };
}

export async function cancelMatchWorkflow(runId: string) {
  const run = await getMatchWorkflow(runId);
  if (run.status !== "completed") await github(`runs/${runId}/cancel`, { method: "POST" });
}
