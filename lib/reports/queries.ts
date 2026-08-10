import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WeeklyReportRow } from "@/lib/reports/types";

const REPORT_COLUMNS = "id,week_key,title,period_start,period_end,patches,status,content,model,generated_at";

export type WeeklyReportSummary = Pick<WeeklyReportRow, "id" | "week_key" | "title" | "period_start" | "period_end">;

async function hydrateTeamLogoPreferences(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  report: WeeklyReportRow | null,
) {
  if (!report) return null;
  const { data, error } = await supabase.from("teams").select("slug,use_white_logo_on_dark");
  if (error) throw new Error(`팀 로고 설정 조회 실패: ${error.message}`);
  const flags = new Map((data ?? []).map((team) => [team.slug, team.use_white_logo_on_dark ?? false]));
  const apply = (team: { slug: string; useWhiteLogoOnDark?: boolean } | null) => {
    if (team) team.useWhiteLogoOnDark = flags.get(team.slug) ?? false;
  };

  report.content.stats.matches.forEach((match) => { apply(match.teamA); apply(match.teamB); });
  report.content.stats.teamWeekly.forEach((row) => apply(row.team));
  report.content.stats.statLeaders.forEach((row) => apply(row.team));
  apply(report.content.review.teamOfWeek.team);
  report.content.review.playersOfWeek.forEach((player) => apply(player.team));
  report.content.preview.matches.forEach((match) => { apply(match.teamA); apply(match.teamB); });
  return report;
}

export const getWeeklyReportIndex = cache(async function getWeeklyReportIndex(): Promise<WeeklyReportSummary[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("id,week_key,title,period_start,period_end")
    .eq("status", "published")
    .order("period_end", { ascending: false });
  if (error) throw new Error(`주간 리포트 목록 조회 실패: ${error.message}`);
  return (data ?? []) as WeeklyReportSummary[];
});

export const getLatestWeeklyReport = cache(async function getLatestWeeklyReport(): Promise<WeeklyReportRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "published")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`최신 주간 리포트 조회 실패: ${error.message}`);
  return hydrateTeamLogoPreferences(supabase, (data as WeeklyReportRow | null) ?? null);
});

export const getWeeklyReportByWeekKey = cache(async function getWeeklyReportByWeekKey(weekKey: string): Promise<WeeklyReportRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "published")
    .eq("week_key", weekKey)
    .maybeSingle();
  if (error) throw new Error(`주간 리포트 조회 실패: ${error.message}`);
  return hydrateTeamLogoPreferences(supabase, (data as WeeklyReportRow | null) ?? null);
});
