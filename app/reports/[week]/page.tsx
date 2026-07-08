import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeeklyReportView } from "@/components/reports/weekly-report-view";
import { getWeeklyReportByWeekKey, getWeeklyReportIndex } from "@/lib/reports/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ week: string }> }): Promise<Metadata> {
  const { week } = await params;
  return { title: `위클리 리포트 ${week} | MINION` };
}

export default async function ReportWeekPage({ params }: { params: Promise<{ week: string }> }) {
  const { week } = await params;
  const [report, index] = await Promise.all([getWeeklyReportByWeekKey(week), getWeeklyReportIndex()]);
  if (!report) notFound();

  return <WeeklyReportView report={report} index={index} />;
}
