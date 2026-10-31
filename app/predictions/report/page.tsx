import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { getMyPredictionReport } from "@/lib/data/prediction-report";
import { PredictionReportView } from "./report-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "내 예측 리포트 | MINION", robots: { index: false, follow: false } };

export default async function PredictionReportPage() {
  const data = await getMyPredictionReport();
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return (
    <main className="layout-wide min-w-0 py-6 text-[var(--ui-text)] sm:py-8 xl:px-10">
      <PageHeader title="내 예측 리포트" breadcrumbs={[{ label: "홈", href: "/" }, { label: "승부예측", href: "/predictions" }, { label: "내 예측 리포트" }]} action={<Link href="/predictions" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"><ArrowLeft size={16} aria-hidden="true" />승부예측</Link>} />
      {data ? <PredictionReportView {...data} now={now} /> : (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-base text-[var(--ui-muted)]">내 예측 기록을 보려면 로그인해 주세요.</p>
          <Link href="/login?next=/predictions/report" className={buttonClassName()}>로그인</Link>
        </div>
      )}
    </main>
  );
}
