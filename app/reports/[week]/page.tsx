import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WeeklyReportView } from "@/components/reports/weekly-report-view";
import { getWeeklyReportByWeekKey, getWeeklyReportIndex } from "@/lib/reports/queries";
import { siteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const { week } = await params;
  const report = await getWeeklyReportByWeekKey(week).catch(() => null);
  const title = report?.title ? `${report.title} | MINION` : `Weekly Report ${week} | MINION`;
  const description = report
    ? `${report.period_start}~${report.period_end} LCK 주간 리포트. 경기 결과, 메타, 선수 폼, 다음 경기 프리뷰를 정리합니다.`
    : "MINION LCK 주간 리포트";

  return {
    title,
    description,
    alternates: { canonical: `/reports/${week}` },
    openGraph: {
      title,
      description,
      url: `${siteBaseUrl()}/reports/${week}`,
      type: "article",
      images: ["/images/minion.png"],
    },
  };
}

export default async function ReportWeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const [report, index] = await Promise.all([getWeeklyReportByWeekKey(week), getWeeklyReportIndex()]);
  if (!report) notFound();

  return <WeeklyReportView report={report} index={index} />;
}
