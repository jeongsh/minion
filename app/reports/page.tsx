import type { Metadata } from "next";
import { WeeklyReportView } from "@/components/reports/weekly-report-view";
import { getLatestWeeklyReport, getWeeklyReportIndex } from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "위클리 리포트 | MINION",
  description: "LCK 한 주의 리뷰, 메타 티어, 기록, 그리고 AI 승부예측까지 — MINION AI 분석실의 주간 리포트",
};

export default async function ReportsPage() {
  const [latest, index] = await Promise.all([getLatestWeeklyReport(), getWeeklyReportIndex()]);

  if (!latest) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-[var(--page-inline)] py-24 text-center">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--ui-muted)]">Minion Weekly Report</p>
        <h1 className="home-section-title mt-3 text-2xl text-[var(--ui-ink)]">첫 리포트를 준비하고 있어요</h1>
        <p className="mt-3 text-sm font-semibold text-[var(--ui-muted)]">매주 월요일, 한 주의 LCK를 정리한 AI 리포트가 이곳에 발행돼요.</p>
      </div>
    );
  }

  return <WeeklyReportView report={latest} index={index} />;
}
