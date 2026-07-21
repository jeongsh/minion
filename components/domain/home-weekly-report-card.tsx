import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import type { WeeklyReportSummary } from "@/lib/reports/queries";

function periodLabel(start: string, end: string) {
  const format = (value: string) => {
    const date = new Date(value);
    return `${date.getMonth() + 1}.${date.getDate()}`;
  };
  return `${format(start)} – ${format(end)}`;
}

/**
 * 홈에서 주간 AI 리포트로 들어가는 진입점.
 * 기념일 배너(CelebrationCard)와 같은 한 줄 바 형태·같은 높이로 맞춰 나란히 놓는다.
 * 리포트 본문은 무거워서 목록 요약(WeeklyReportSummary)만 받는다.
 */
export function HomeWeeklyReportCard({ report }: { report: WeeklyReportSummary }) {
  return (
    <Link
      href={`/reports/${report.week_key}`}
      className="group flex items-center gap-3 rounded-2xl border border-[#e6e7ea] bg-white px-4 py-3 transition hover:border-[var(--ui-ink)] sm:gap-5 sm:px-6 sm:py-3.5 dark:border-[#343840] dark:bg-[var(--ui-surface-muted)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--ui-surface-muted)] text-[var(--ui-ink)] sm:h-10 sm:w-10 dark:bg-[#343840]">
        <FileText size={18} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold text-[var(--ui-muted)] sm:text-sm">
          주간 리포트 · {periodLabel(report.period_start, report.period_end)}
        </span>
        <span className="font-paperozi block truncate text-sm text-[var(--ui-ink)] sm:text-base">
          {report.title}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#1c192b] px-2.5 py-2 text-[13px] font-bold text-white sm:px-3.5">
        <span className="hidden sm:inline">리포트 읽기</span>
        <ChevronRight size={14} strokeWidth={2.5} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
