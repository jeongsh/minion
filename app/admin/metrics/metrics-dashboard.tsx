"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { SegmentedToggle } from "@/components/ui/tabs";
import type {
  SiteMetricKey,
  SiteMetricsDashboard,
  SiteMetricSource,
  SiteMetricSourceResult,
} from "@/lib/site-metrics";

import { refreshSiteMetricsAction } from "./actions";
import { MetricsChart } from "./metrics-chart";

type RangeKey = "7" | "30";

const RANGE_ITEMS: ReadonlyArray<{ key: RangeKey; label: string }> = [
  { key: "7", label: "7일" },
  { key: "30", label: "30일" },
];

const METRICS: ReadonlyArray<{ key: SiteMetricKey; label: string; source: SiteMetricSource | null }> = [
  { key: "visitors", label: "방문자", source: "vercel" },
  { key: "pageviews", label: "페이지뷰", source: "vercel" },
  { key: "signups", label: "신규 가입", source: null },
  { key: "adsense_earnings", label: "애드센스 수익", source: "adsense" },
  { key: "search_clicks", label: "검색 클릭", source: "searchConsole" },
];

const SOURCE_LABELS: Record<SiteMetricSource, string> = {
  vercel: "Vercel",
  adsense: "AdSense",
  searchConsole: "Search Console",
};

function formatCount(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function currencyFormatter(currency: string | null) {
  if (!currency) return formatCount;
  const fractionDigits = currency === "KRW" || currency === "JPY" ? 0 : 2;
  const formatter = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return (value: number) => formatter.format(value);
}

function sumRange(values: Array<number | null>, from: number, to: number) {
  const slice = values.slice(from, to).filter((value): value is number => value !== null);
  return slice.length ? slice.reduce((total, value) => total + value, 0) : null;
}

function formatFetchedAt(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null }) {
  if (current === null || previous === null || previous <= 0) return null;
  const delta = Math.round(((current - previous) / previous) * 100);
  const positive = delta >= 0;
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[13px] font-medium tabular-nums ${
        positive
          ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-emerald-600 dark:text-[var(--accent)]"
          : "bg-red-500/15 text-red-600 dark:text-red-400"
      }`}
    >
      {positive ? "+" : ""}
      {delta}%
    </span>
  );
}

export function MetricsDashboard({
  dashboard,
  configured,
}: {
  dashboard: SiteMetricsDashboard;
  configured: Record<SiteMetricSource, boolean>;
}) {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("7");
  const [active, setActive] = useState<SiteMetricKey>("visitors");
  const [results, setResults] = useState<SiteMetricSourceResult[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const length = Number(range) as 7 | 30;
  const total = dashboard.dates.length;
  const currentFrom = total - length;
  const formatEarnings = currencyFormatter(dashboard.adsenseCurrency);
  const formatterFor = (key: SiteMetricKey) => (key === "adsense_earnings" ? formatEarnings : formatCount);

  const summaries = METRICS.map((metric) => {
    const values = dashboard.series[metric.key];
    let current = sumRange(values, currentFrom, total);
    let previous = sumRange(values, currentFrom - length, currentFrom);
    // 방문자는 일별 합이 아니라 기간 고유 방문자 수를 보여준다.
    if (metric.key === "visitors" && dashboard.visitorPeriods[length]) {
      current = dashboard.visitorPeriods[length]!.current;
      previous = dashboard.visitorPeriods[length]!.previous;
    }
    const needsSetup = metric.source !== null && !configured[metric.source] && current === null;
    return { ...metric, current, previous, needsSetup };
  });

  const activeMetric = summaries.find((metric) => metric.key === active)!;
  const fetchedTimes = Object.values(dashboard.lastFetchedAt).filter((value): value is string => Boolean(value));
  const lastFetchedAt = fetchedTimes.sort().at(-1) ?? null;
  const failed = results?.filter((result) => result.status === "error") ?? [];

  function refresh() {
    startTransition(async () => {
      const next = await refreshSiteMetricsAction();
      setResults(next);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <SegmentedToggle items={RANGE_ITEMS} activeKey={range} ariaLabel="기간" onSelect={setRange} />
        <div className="flex items-center gap-3">
          {lastFetchedAt ? (
            <span className="hidden text-[13px] text-[var(--ui-muted)] sm:inline">
              {formatFetchedAt(lastFetchedAt)} 업데이트
            </span>
          ) : null}
          <Button onClick={refresh} disabled={isPending}>
            {isPending ? "업데이트 중" : "지금 업데이트"}
          </Button>
        </div>
      </div>

      {failed.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
          {failed.map((result) => (
            <li key={result.source} className="break-all">
              {SOURCE_LABELS[result.source]} 업데이트 실패: {result.error}
            </li>
          ))}
        </ul>
      ) : null}

      <section className="overflow-hidden rounded-[var(--ui-card-radius)] bg-[var(--ui-card-bg)]">
        <div role="tablist" aria-label="지표" className="flex overflow-x-auto border-b border-[var(--ui-card-divider)]">
          {summaries.map((metric) => {
            const selected = metric.key === active;
            return (
              <button
                key={metric.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(metric.key)}
                className={`-mb-px flex min-w-[148px] flex-1 flex-col items-start gap-2 border-b-2 px-4 py-4 text-left transition-colors sm:px-5 ${
                  selected
                    ? "border-[var(--ui-ink)] bg-[var(--ui-card-hover)]"
                    : "border-transparent hover:bg-[var(--ui-card-hover)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--ui-muted)]">{metric.label}</span>
                <span className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1">
                  {metric.needsSetup ? (
                    <span className="text-[13px] font-medium text-[var(--ui-muted)]">연결 필요</span>
                  ) : (
                    <>
                      <span className="text-[28px] font-bold leading-none tabular-nums text-[var(--ui-ink)]">
                        {metric.current === null ? "-" : formatterFor(metric.key)(metric.current)}
                      </span>
                      <DeltaBadge current={metric.current} previous={metric.previous} />
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-[var(--ui-muted)]">
            <span>
              누적 수익{" "}
              <span className="font-medium tabular-nums text-[var(--ui-ink)]">
                {dashboard.adsenseTotal
                  ? currencyFormatter(dashboard.adsenseTotal.currency)(dashboard.adsenseTotal.value)
                  : "-"}
              </span>
            </span>
            <span>
              전체 회원{" "}
              <span className="font-medium tabular-nums text-[var(--ui-ink)]">
                {formatCount(dashboard.totalMembers)}명
              </span>
            </span>
            <a
              href="https://searchadvisor.naver.com/console/board"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[var(--ui-ink)] underline-offset-4 hover:underline sm:ml-auto"
            >
              네이버 서치어드바이저
            </a>
          </div>

          {activeMetric.needsSetup ? (
            <p className="py-16 text-center text-base text-[var(--ui-muted)]">
              {SOURCE_LABELS[activeMetric.source!]} 환경변수를 설정하면 추이가 표시됩니다.
            </p>
          ) : (
            <MetricsChart
              key={`${active}-${range}`}
              dates={dashboard.dates.slice(currentFrom)}
              values={dashboard.series[active].slice(currentFrom)}
              formatValue={formatterFor(active)}
              partialLast
            />
          )}
        </div>
      </section>
    </div>
  );
}
