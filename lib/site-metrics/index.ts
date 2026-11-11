import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import {
  collectAdsense,
  collectSearchConsole,
  collectVercelAnalytics,
  kstDate,
  REFERRER_METRIC_PREFIX,
  SiteMetricSourceNotConfiguredError,
  type SiteMetricRow,
} from "./sources";

export type SiteMetricSource = "vercel" | "adsense" | "searchConsole";
export type SiteMetricKey = "visitors" | "pageviews" | "signups" | "adsense_earnings" | "search_clicks";

export type SiteMetricSourceResult = {
  source: SiteMetricSource;
  status: "ok" | "not_configured" | "error";
  rows: number;
  error?: string;
};

/** 대시보드가 보여주는 최대 기간(30일)과 직전 비교 기간을 함께 담는다. */
export const SITE_METRICS_WINDOW_DAYS = 60;
/** 새로고침마다 다시 받는 일수. 늦게 확정되는 수익과 검색 지표를 덮어쓴다. */
const REFRESH_DAYS = 35;

const collectors: Record<SiteMetricSource, (days: number) => Promise<SiteMetricRow[]>> = {
  vercel: collectVercelAnalytics,
  adsense: collectAdsense,
  searchConsole: collectSearchConsole,
};

/** 외부 소스를 모두 다시 받아 site_metrics_daily에 저장한다. 한 소스가 실패해도 나머지는 저장한다. */
export async function refreshSiteMetrics(): Promise<SiteMetricSourceResult[]> {
  const supabase = createSupabaseAdminClient();
  const fetchedAt = new Date().toISOString();

  return Promise.all(
    (Object.keys(collectors) as SiteMetricSource[]).map(async (source): Promise<SiteMetricSourceResult> => {
      try {
        const rows = await collectors[source](REFRESH_DAYS);
        if (rows.length > 0) {
          const { error } = await supabase
            .from("site_metrics_daily")
            .upsert(rows.map((row) => ({ ...row, fetched_at: fetchedAt })), { onConflict: "metric_date,metric" });
          if (error) throw new Error(error.message);
        }
        return { source, status: "ok", rows: rows.length };
      } catch (error) {
        if (error instanceof SiteMetricSourceNotConfiguredError) {
          return { source, status: "not_configured", rows: 0, error: error.message };
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[site-metrics] ${source} refresh failed`, error);
        return { source, status: "error", rows: 0, error: message };
      }
    }),
  );
}

/** 환경변수 존재 여부만 본다. 값이 틀린 경우는 새로고침 결과의 오류로 드러난다. */
export function getSiteMetricSourceConfig(): Record<SiteMetricSource, boolean> {
  const google = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
  return {
    vercel: Boolean(process.env.VERCEL_ANALYTICS_TOKEN && process.env.VERCEL_ANALYTICS_PROJECT_ID),
    adsense: google && Boolean(process.env.ADSENSE_ACCOUNT_ID || process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT),
    searchConsole: google,
  };
}

export type SiteMetricsDashboard = {
  /** 오래된 날짜부터 오늘(KST)까지 SITE_METRICS_WINDOW_DAYS개. */
  dates: string[];
  series: Record<SiteMetricKey, Array<number | null>>;
  /** 기간 고유 방문자. Vercel 수집 전이면 null. */
  visitorPeriods: Record<7 | 30, { current: number; previous: number } | null>;
  adsenseTotal: { value: number; currency: string | null } | null;
  adsenseCurrency: string | null;
  /** 기간별 유입 경로 상위(방문자 많은 순). 가장 최근 수집분만 담는다. */
  referrers: Record<7 | 30, Array<{ host: string; visitors: number }>>;
  totalMembers: number;
  lastFetchedAt: Record<SiteMetricSource, string | null>;
};

const METRIC_SOURCE: Record<string, SiteMetricSource> = {
  visitors: "vercel",
  pageviews: "vercel",
  visitors_period_7: "vercel",
  visitors_period_7_prev: "vercel",
  visitors_period_30: "vercel",
  visitors_period_30_prev: "vercel",
  adsense_earnings: "adsense",
  adsense_total: "adsense",
  search_clicks: "searchConsole",
  search_impressions: "searchConsole",
};

export async function getSiteMetricsDashboard(): Promise<SiteMetricsDashboard> {
  const supabase = createSupabaseAdminClient();
  const dates = Array.from({ length: SITE_METRICS_WINDOW_DAYS }, (_, index) =>
    kstDate(index - (SITE_METRICS_WINDOW_DAYS - 1)),
  );
  const firstDate = dates[0];
  const firstDateStartIso = new Date(Date.parse(`${firstDate}T00:00:00+09:00`)).toISOString();

  const [metricsResult, referrersResult, signupsResult, membersResult] = await Promise.all([
    // 유입 경로 행은 하루에 수십 개씩 쌓여 기본 조회 한도를 넘길 수 있으므로 일별 지표와 따로 읽는다.
    supabase
      .from("site_metrics_daily")
      .select("metric_date, metric, value, unit, fetched_at")
      .gte("metric_date", firstDate)
      .not("metric", "like", `${REFERRER_METRIC_PREFIX}%`)
      .order("metric_date", { ascending: true }),
    supabase
      .from("site_metrics_daily")
      .select("metric, value, fetched_at")
      .like("metric", `${REFERRER_METRIC_PREFIX}%`)
      .order("fetched_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("created_at").gte("created_at", firstDateStartIso),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  if (metricsResult.error) throw new Error(metricsResult.error.message);
  if (referrersResult.error) throw new Error(referrersResult.error.message);
  if (signupsResult.error) throw new Error(signupsResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);

  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const emptySeries = () => dates.map((): number | null => null);
  const series: SiteMetricsDashboard["series"] = {
    visitors: emptySeries(),
    pageviews: emptySeries(),
    signups: dates.map(() => 0),
    adsense_earnings: emptySeries(),
    search_clicks: emptySeries(),
  };

  const lastFetchedAt: SiteMetricsDashboard["lastFetchedAt"] = { vercel: null, adsense: null, searchConsole: null };
  const latestByMetric = new Map<string, { date: string; value: number; unit: string | null }>();
  let adsenseCurrency: string | null = null;

  for (const row of metricsResult.data ?? []) {
    const value = Number(row.value);
    const index = dateIndex.get(row.metric_date);
    if (index !== undefined && row.metric in series) {
      series[row.metric as SiteMetricKey][index] = value;
    }
    if (row.metric === "adsense_earnings" && row.unit) adsenseCurrency = row.unit;

    const previous = latestByMetric.get(row.metric);
    if (!previous || previous.date <= row.metric_date) {
      latestByMetric.set(row.metric, { date: row.metric_date, value, unit: row.unit });
    }

    const source = METRIC_SOURCE[row.metric];
    if (source && (!lastFetchedAt[source] || lastFetchedAt[source]! < row.fetched_at)) {
      lastFetchedAt[source] = row.fetched_at;
    }
  }

  for (const row of signupsResult.data ?? []) {
    const date = kstDate(0, Date.parse(row.created_at));
    const index = dateIndex.get(date);
    if (index !== undefined) series.signups[index] = (series.signups[index] ?? 0) + 1;
  }

  const period = (length: 7 | 30) => {
    const current = latestByMetric.get(`visitors_period_${length}`);
    const previous = latestByMetric.get(`visitors_period_${length}_prev`);
    return current && previous ? { current: current.value, previous: previous.value } : null;
  };
  const adsenseTotal = latestByMetric.get("adsense_total");

  // 한 번의 수집은 같은 fetched_at을 공유한다. 가장 최근 수집분만 써서 순위에서 빠진 경로가 남지 않게 한다.
  const latestReferrerFetch = referrersResult.data?.[0]?.fetched_at ?? null;
  const referrers: SiteMetricsDashboard["referrers"] = { 7: [], 30: [] };
  for (const row of referrersResult.data ?? []) {
    if (row.fetched_at !== latestReferrerFetch) continue;
    const [length, ...hostParts] = row.metric.slice(REFERRER_METRIC_PREFIX.length).split(":");
    const host = hostParts.join(":");
    if ((length !== "7" && length !== "30") || !host) continue;
    referrers[Number(length) as 7 | 30].push({ host, visitors: Number(row.value) });
  }
  referrers[7].sort((a, b) => b.visitors - a.visitors);
  referrers[30].sort((a, b) => b.visitors - a.visitors);

  return {
    dates,
    series,
    visitorPeriods: { 7: period(7), 30: period(30) },
    adsenseTotal: adsenseTotal ? { value: adsenseTotal.value, currency: adsenseTotal.unit } : null,
    adsenseCurrency: adsenseCurrency ?? adsenseTotal?.unit ?? null,
    referrers,
    totalMembers: membersResult.count ?? 0,
    lastFetchedAt,
  };
}
