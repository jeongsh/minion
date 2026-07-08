import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WeeklyReportRow } from "@/lib/reports/types";

const REPORT_COLUMNS = "id,week_key,title,period_start,period_end,patches,status,content,model,generated_at";

export type WeeklyReportSummary = Pick<WeeklyReportRow, "id" | "week_key" | "title" | "period_start" | "period_end">;

export async function getWeeklyReportIndex(): Promise<WeeklyReportSummary[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select("id,week_key,title,period_start,period_end")
    .eq("status", "published")
    .order("period_end", { ascending: false });
  if (error) throw new Error(`주간 리포트 목록 조회 실패: ${error.message}`);
  return (data ?? []) as WeeklyReportSummary[];
}

export async function getLatestWeeklyReport(): Promise<WeeklyReportRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "published")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`최신 주간 리포트 조회 실패: ${error.message}`);
  return (data as WeeklyReportRow | null) ?? null;
}

export async function getWeeklyReportByWeekKey(weekKey: string): Promise<WeeklyReportRow | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(REPORT_COLUMNS)
    .eq("status", "published")
    .eq("week_key", weekKey)
    .maybeSingle();
  if (error) throw new Error(`주간 리포트 조회 실패: ${error.message}`);
  return (data as WeeklyReportRow | null) ?? null;
}
