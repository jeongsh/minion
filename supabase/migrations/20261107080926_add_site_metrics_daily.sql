-- 관리자 지표 대시보드용 외부 지표(Vercel Web Analytics, AdSense, Search Console) 일별 스냅샷.
-- 크론과 관리자 새로고침이 최근 구간을 다시 받아 upsert하므로 늦게 확정되는 값도 덮어쓴다.
-- metric_date는 각 소스의 기준 날짜다. 기간 합계(방문자 고유 수, 누적 수익)는 수집일 행에 저장한다.
create table public.site_metrics_daily (
  metric_date date not null,
  metric text not null check (char_length(metric) between 1 and 64),
  value numeric not null,
  unit text check (unit is null or char_length(unit) <= 16),
  fetched_at timestamptz not null default now(),
  primary key (metric_date, metric)
);

create index site_metrics_daily_metric_date_idx
  on public.site_metrics_daily (metric, metric_date desc);

alter table public.site_metrics_daily enable row level security;
revoke all on public.site_metrics_daily from anon, authenticated;
grant all on public.site_metrics_daily to service_role;
