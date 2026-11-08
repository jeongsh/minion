import "server-only";

// 관리자 지표 대시보드의 외부 소스 수집기. 각 함수는 일별 행 배열을 돌려주고 저장은 호출부가 맡는다.
// 설정이 없으면 SiteMetricSourceNotConfiguredError를 던져 화면에서 "연결 필요"로 구분한다.

export type SiteMetricRow = {
  metric_date: string;
  metric: string;
  value: number;
  unit: string | null;
};

export class SiteMetricSourceNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteMetricSourceNotConfiguredError";
  }
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 날짜 문자열(YYYY-MM-DD). offsetDays만큼 이동한다. */
export function kstDate(offsetDays = 0, now = Date.now()) {
  return new Date(now + KST_OFFSET_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

async function readJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${label} ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Vercel Web Analytics

type VercelAggregateResponse = {
  data: Array<{ timestamp: string; pageviews?: number; visitors?: number }>;
};

/** UTC 기준 날짜 문자열(YYYY-MM-DD). Vercel 일별 집계의 날짜 단위다. */
function utcDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

type VercelCountResponse = {
  data: { pageviews?: number; visitors?: number };
};

function vercelConfig() {
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID;
  if (!token || !projectId) {
    throw new SiteMetricSourceNotConfiguredError("VERCEL_ANALYTICS_TOKEN, VERCEL_ANALYTICS_PROJECT_ID가 필요합니다.");
  }
  return { token, projectId, teamId };
}

async function vercelQuery<T>(path: string, params: Record<string, string>) {
  const { token, projectId, teamId } = vercelConfig();
  const url = new URL(`https://api.vercel.com/v1/query/web-analytics/${path}`);
  url.searchParams.set("projectId", projectId);
  if (teamId) url.searchParams.set("teamId", teamId);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return readJson<T>(response, "Vercel Web Analytics");
}

/** 최근 days일의 일별 방문자와 페이지뷰, 7일과 30일 고유 방문자(직전 기간 포함)를 받는다. */
export async function collectVercelAnalytics(days: number): Promise<SiteMetricRow[]> {
  vercelConfig();
  const today = kstDate();

  // Vercel은 조회 범위를 UTC 날짜 단위로 맞추고 시간대를 바꿀 수 없다. 그래서 Vercel 지표는 UTC 날짜로 저장한다.
  // 한국 오전 9시 전에는 오늘(UTC)이 아직 시작 전이라 범위 끝을 UTC 오늘로 둬서 빈 날을 만들지 않는다.
  const utcToday = utcDate();
  const aggregate = await vercelQuery<VercelAggregateResponse>("visits/aggregate", {
    by: "day",
    since: utcDate(-(days - 1)),
    until: utcToday,
    limit: "100",
  });

  const rows: SiteMetricRow[] = (aggregate.data ?? []).flatMap((point) => {
    const date = point.timestamp.slice(0, 10);
    return [
      { metric_date: date, metric: "visitors", value: point.visitors ?? 0, unit: null },
      { metric_date: date, metric: "pageviews", value: point.pageviews ?? 0, unit: null },
    ];
  });

  // 기간 방문자는 일별 합이 아니라 고유 방문자 수라 기간마다 따로 센다. 경계는 일별과 같은 UTC 날짜다.
  const periods = [7, 30].flatMap((length) => [
    { metric: `visitors_period_${length}`, since: utcDate(-(length - 1)), until: utcToday },
    { metric: `visitors_period_${length}_prev`, since: utcDate(-(2 * length - 1)), until: utcDate(-length) },
  ]);

  const counts = await Promise.all(
    periods.map((period) => vercelQuery<VercelCountResponse>("visits/count", { since: period.since, until: period.until })),
  );
  counts.forEach((count, index) => {
    rows.push({ metric_date: today, metric: periods[index].metric, value: count.data?.visitors ?? 0, unit: null });
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Google OAuth (AdSense, Search Console 공용)

let cachedGoogleToken: { value: string; expiresAt: number } | null = null;

async function googleAccessToken() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new SiteMetricSourceNotConfiguredError(
      "GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN이 필요합니다.",
    );
  }
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60_000) return cachedGoogleToken.value;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const token = await readJson<{ access_token: string; expires_in: number }>(response, "Google OAuth");
  cachedGoogleToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

// ---------------------------------------------------------------------------
// AdSense

type AdsenseReport = {
  headers?: Array<{ name: string; type: string; currencyCode?: string }>;
  rows?: Array<{ cells: Array<{ value: string }> }>;
  totals?: { cells: Array<{ value: string }> };
};

function adsenseAccount() {
  const explicit = process.env.ADSENSE_ACCOUNT_ID?.trim();
  const publisher = explicit || process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim().replace(/^ca-/, "");
  if (!publisher) throw new SiteMetricSourceNotConfiguredError("ADSENSE_ACCOUNT_ID(pub-...)가 필요합니다.");
  return publisher.startsWith("accounts/") ? publisher : `accounts/${publisher}`;
}

function setDateParams(url: URL, prefix: "startDate" | "endDate", date: string) {
  const [year, month, day] = date.split("-");
  url.searchParams.set(`${prefix}.year`, String(Number(year)));
  url.searchParams.set(`${prefix}.month`, String(Number(month)));
  url.searchParams.set(`${prefix}.day`, String(Number(day)));
}

async function adsenseReport(startDate: string, endDate: string, byDate: boolean) {
  const accessToken = await googleAccessToken();
  const url = new URL(`https://adsense.googleapis.com/v2/${adsenseAccount()}/reports:generate`);
  url.searchParams.set("dateRange", "CUSTOM");
  setDateParams(url, "startDate", startDate);
  setDateParams(url, "endDate", endDate);
  url.searchParams.set("metrics", "ESTIMATED_EARNINGS");
  url.searchParams.set("reportingTimeZone", "ACCOUNT_TIME_ZONE");
  if (byDate) url.searchParams.set("dimensions", "DATE");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return readJson<AdsenseReport>(response, "AdSense");
}

/** 최근 days일의 일별 예상 수익과 시작일부터의 누적 예상 수익을 받는다. */
export async function collectAdsense(days: number): Promise<SiteMetricRow[]> {
  adsenseAccount();
  const today = kstDate();
  const startDate = process.env.ADSENSE_EARNINGS_START_DATE || "2026-06-01";

  const [daily, total] = await Promise.all([
    adsenseReport(kstDate(-(days - 1)), today, true),
    adsenseReport(startDate, today, false),
  ]);

  const earningsIndex = (report: AdsenseReport) =>
    Math.max(0, report.headers?.findIndex((header) => header.name === "ESTIMATED_EARNINGS") ?? 0);
  const currency = (report: AdsenseReport) =>
    report.headers?.find((header) => header.name === "ESTIMATED_EARNINGS")?.currencyCode ?? null;

  const dailyIndex = earningsIndex(daily);
  const dateIndex = Math.max(0, daily.headers?.findIndex((header) => header.name === "DATE") ?? 0);
  const rows: SiteMetricRow[] = (daily.rows ?? []).map((row) => ({
    metric_date: row.cells[dateIndex].value,
    metric: "adsense_earnings",
    value: Number(row.cells[dailyIndex]?.value ?? 0),
    unit: currency(daily),
  }));

  rows.push({
    metric_date: today,
    metric: "adsense_total",
    value: Number(total.totals?.cells[earningsIndex(total)]?.value ?? 0),
    unit: currency(total),
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Search Console

type SearchAnalyticsResponse = {
  rows?: Array<{ keys: string[]; clicks: number; impressions: number }>;
};

/** 최근 days일의 일별 검색 클릭과 노출을 받는다. 최근 2~3일은 Google이 아직 집계 중일 수 있다. */
export async function collectSearchConsole(days: number): Promise<SiteMetricRow[]> {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL || "sc-domain:minion.fan";
  const accessToken = await googleAccessToken();

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: kstDate(-(days - 1)),
        endDate: kstDate(),
        dimensions: ["date"],
        dataState: "all",
        rowLimit: 1000,
      }),
      cache: "no-store",
    },
  );
  const data = await readJson<SearchAnalyticsResponse>(response, "Search Console");

  return (data.rows ?? []).flatMap((row) => [
    { metric_date: row.keys[0], metric: "search_clicks", value: row.clicks, unit: null },
    { metric_date: row.keys[0], metric: "search_impressions", value: row.impressions, unit: null },
  ]);
}
