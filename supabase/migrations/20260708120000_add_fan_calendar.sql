-- 덕질 달력: 관리자 입력 기념일(데뷔/우승/커스텀) + 축하 메시지 보드.
-- 생일은 players.birth_date에서 자동 파생하므로 이 테이블에 넣지 않는다.

create table public.fan_calendar_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('debut', 'championship', 'custom')),
  team_id uuid references public.teams(id) on delete cascade,
  player_id uuid references public.players(id) on delete cascade,
  title text not null,
  event_date date not null,
  is_recurring boolean not null default true,
  created_at timestamptz not null default now()
);

create index fan_calendar_events_team_id_idx on public.fan_calendar_events(team_id);

-- 축하 메시지 보드. event_key = 'birthday:{playerId}:{year}' 또는 'event:{fanCalendarEventId}:{year}'
create table public.celebration_messages (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index celebration_messages_event_key_idx on public.celebration_messages(event_key, created_at desc);

alter table public.fan_calendar_events enable row level security;
alter table public.celebration_messages enable row level security;

-- 읽기는 공개, 쓰기는 service-role(관리자/서버 액션)만.
create policy "public read fan calendar events" on public.fan_calendar_events for select using (true);
create policy "public read celebration messages" on public.celebration_messages for select using (true);

grant select on public.fan_calendar_events to anon, authenticated;
grant select on public.celebration_messages to anon, authenticated;
