import Link from "next/link";
import { ChevronRight } from "lucide-react";

import marker from "@/assets/characters/pen-1.png";
import type { WeeklyReportSummary } from "@/lib/reports/queries";
import { KITSCH_PALETTES } from "@/lib/theme/palettes";

const REPORT_MAIN = KITSCH_PALETTES.grapeLime.main;
const REPORT_POINT = KITSCH_PALETTES.grapeLime.point;

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
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 transition hover:brightness-105 sm:justify-center sm:gap-5 sm:px-6 sm:py-3.5"
      style={{ backgroundColor: REPORT_MAIN }}
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-[var(--ui-ink)] sm:h-14 sm:w-14">
        <img src={marker.src} alt="" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
      </span>

      <span className="min-w-0 flex-1 sm:flex-initial">
        <span className="flex min-w-0 items-center gap-2 text-[12px] font-bold sm:text-sm" style={{ color: REPORT_POINT }}>
          <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black" style={{ backgroundColor: REPORT_POINT, color: REPORT_MAIN }}>
            NEW NOTES
          </span>
          <span className="truncate">주간 리포트 · {periodLabel(report.period_start, report.period_end)}</span>
        </span>
        <span className="font-paperozi block truncate text-sm text-white sm:text-base">
          {report.title}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-white px-2.5 py-2 text-[13px] font-bold sm:px-3.5" style={{ color: REPORT_MAIN }}>
        <span className="hidden sm:inline">리포트 읽기</span>
        <ChevronRight size={14} strokeWidth={2.5} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
