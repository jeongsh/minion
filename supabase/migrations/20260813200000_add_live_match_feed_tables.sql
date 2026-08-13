-- 실시간(라이브) 경기 이벤트 피드용 테이블.
-- live_match_cursors: 매치당 1행, lolesports 라이브 스탯과 비교할 "직전 스냅샷"을
--   들고 있는 diff 기준점. 게임 진행 중에만 의미가 있고, 새 폴링마다 최신값으로
--   덮어써진다.
-- live_match_events: diff에서 감지된 킬/오브젝트를 쌓아두는 append-only 로그.
--   나중에 들어온 시청자도 게임 시작부터의 히스토리를 그대로 볼 수 있게 한다.
-- 경기가 끝나면(matches.status = 'completed', 공식 타임라인이 대신하게 되는 시점)
-- 둘 다 정리한다 — API 라우트에서 그 시점에 delete한다.

create table if not exists public.live_match_cursors (
  match_id uuid primary key references public.matches(id) on delete cascade,
  lolesports_game_id text not null,
  blue_team_id uuid references public.teams(id) on delete set null,
  red_team_id uuid references public.teams(id) on delete set null,
  blue_kills integer not null default 0,
  red_kills integer not null default 0,
  blue_towers integer not null default 0,
  red_towers integer not null default 0,
  blue_barons integer not null default 0,
  red_barons integer not null default 0,
  blue_inhibitors integer not null default 0,
  red_inhibitors integer not null default 0,
  blue_dragon_types text[] not null default '{}',
  red_dragon_types text[] not null default '{}',
  participant_stats jsonb not null default '{}'::jsonb,
  duration_seconds integer,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  event_type text not null check (event_type in ('kill', 'tower', 'baron', 'inhibitor', 'dragon', 'end')),
  side text check (side in ('blue', 'red')),
  team_id uuid references public.teams(id) on delete set null,
  killer_summoner_name text,
  killer_champion_id text,
  victim_summoner_name text,
  victim_champion_id text,
  dragon_type text,
  game_clock_seconds integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_live_match_events_match_id on public.live_match_events(match_id, created_at desc);

alter table public.live_match_cursors enable row level security;
alter table public.live_match_events enable row level security;

grant select on public.live_match_cursors, public.live_match_events to anon, authenticated;
grant all on public.live_match_cursors, public.live_match_events to service_role;

create policy "public read live match cursors" on public.live_match_cursors for select using (true);
create policy "public read live match events" on public.live_match_events for select using (true);
