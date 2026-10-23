-- 로컬 DB에 최근 세트가 부족한 팀(주로 해외팀)의 Leaguepedia 최근 경기 원본을 미리 보관한다.
-- 프리뷰 생성과 조회는 이 행을 병합해 쓰고, 크론이 주기적으로 최신 경기로 갱신한다.
create table public.team_briefing_sources (
  team_id uuid primary key references public.teams(id) on delete cascade,
  leaguepedia_page text not null,
  rows jsonb not null,
  set_count integer not null check (set_count >= 0),
  latest_match_at timestamptz,
  fetched_at timestamptz not null default now()
);

alter table public.team_briefing_sources enable row level security;
revoke all on public.team_briefing_sources from anon, authenticated;
grant all on public.team_briefing_sources to service_role;
