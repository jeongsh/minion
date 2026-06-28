-- 팀 인기도 컬럼
alter table public.teams
  add column if not exists popularity integer not null default 0;

-- 팀 팬 테이블 (voter_key = SHA-256(cookie UUID))
create table if not exists public.team_fans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (team_id, voter_key)
);

create index if not exists idx_team_fans_team_id on public.team_fans(team_id);
create index if not exists idx_team_fans_voter_key on public.team_fans(voter_key);

grant select, insert, delete on public.team_fans to anon, authenticated;

-- 팀 출석체크 테이블 (하루에 한 팀에서만 가능 → voter_key + checkin_date unique)
create table if not exists public.team_checkins (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  voter_key text not null,
  checkin_date date not null,
  created_at timestamptz not null default now(),
  unique (voter_key, checkin_date)
);

create index if not exists idx_team_checkins_team_id on public.team_checkins(team_id);
create index if not exists idx_team_checkins_voter_key on public.team_checkins(voter_key);

grant select, insert on public.team_checkins to anon, authenticated;

-- 인기도 원자적 증감 함수 (0 미만으로 내려가지 않음)
create or replace function public.adjust_team_popularity(p_team_id uuid, p_delta integer)
returns void
language sql
as $$
  update public.teams
  set popularity = greatest(0, popularity + p_delta)
  where id = p_team_id;
$$;
