import type { Metadata } from "next";
import { WeeklyReportView } from "@/components/reports/weekly-report-view";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
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
      <div className="layout-reading py-20">
        <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">Minion Weekly Report</p>
        <KitschEmptyState
          character="marker"
          title="첫 리포트, 열심히 밑줄 긋는 중"
          body="매주 월요일, 한 주의 LCK를 정리한 AI 리포트가 이곳에 발행돼요."
          animated
          className="mt-4"
        />
      </div>
    );
  }

  return <WeeklyReportView report={latest} index={index} />;
}
