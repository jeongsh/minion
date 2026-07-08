-- 주간 AI 리포트: 주간 리뷰 / 메타 티어리스트 / 데이터 하이라이트 / 다음 주 프리뷰 + AI 승부예측.
-- 생성은 scripts/generate-weekly-report.ts(service role)에서 수행하고,
-- 클라이언트는 published 상태만 읽는다.
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_key text not null unique,
  title text not null,
  period_start date not null,
  period_end date not null,
  patches text[] not null default '{}',
  status text not null default 'published' check (status in ('draft', 'published')),
  content jsonb not null,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_weekly_reports_period_end on public.weekly_reports(period_end desc);

alter table public.weekly_reports enable row level security;

create policy "public read published weekly reports"
  on public.weekly_reports for select
  using (status = 'published');
