// 1회용: weekly_reports.content에 비정규화돼 저장된 팀 정보(color/logo/이름)를
// 현재 teams 테이블 값으로 갱신한다. 해외팀 색상이 기본 회색으로 저장된 리포트 보정용.
//
//   node --experimental-strip-types scripts/backfill-weekly-report-team-colors.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

type TeamRow = { slug: string; name: string; short_name: string; logo_url: string | null; logo_white_url: string | null; primary_color: string };

// ReportTeamRef 모양({ slug, color, shortName... })의 객체를 재귀 탐색해 최신 팀 정보로 덮어쓴다.
function refreshTeamRefs(node: unknown, teamBySlug: Map<string, TeamRow>): number {
  if (Array.isArray(node)) return node.reduce((sum: number, item) => sum + refreshTeamRefs(item, teamBySlug), 0);
  if (!node || typeof node !== "object") return 0;

  const record = node as Record<string, unknown>;
  let updated = 0;
  if (typeof record.slug === "string" && "color" in record && "shortName" in record) {
    const team = teamBySlug.get(record.slug);
    if (team) {
      record.color = team.primary_color;
      record.name = team.name;
      record.shortName = team.short_name;
      record.logoUrl = team.logo_url;
      record.logoWhiteUrl = team.logo_white_url;
      updated += 1;
    }
  }
  for (const value of Object.values(record)) updated += refreshTeamRefs(value, teamBySlug);
  return updated;
}

async function main() {
  loadEnvFile();
  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: teams, error: teamsError } = await supabase.from("teams").select("slug,name,short_name,logo_url,logo_white_url,primary_color");
  if (teamsError) throw new Error(teamsError.message);
  const teamBySlug = new Map((teams as TeamRow[]).map((team) => [team.slug, team]));

  const { data: reports, error: reportsError } = await supabase.from("weekly_reports").select("id,week_key,content");
  if (reportsError) throw new Error(reportsError.message);

  for (const report of reports ?? []) {
    const refreshed = refreshTeamRefs(report.content, teamBySlug);
    const { error } = await supabase.from("weekly_reports").update({ content: report.content }).eq("id", report.id);
    if (error) throw new Error(`${report.week_key} 저장 실패: ${error.message}`);
    console.log(`${report.week_key}: 팀 참조 ${refreshed}개 갱신`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
