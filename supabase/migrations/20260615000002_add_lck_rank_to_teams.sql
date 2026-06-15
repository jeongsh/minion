create table if not exists public.team_standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  rank integer not null,
  wins integer not null default 0,
  losses integer not null default 0,
  set_diff integer not null default 0,
  win_rate numeric(5,4),
  kda numeric(6,2),
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, team_id)
);

create index if not exists idx_team_standings_tournament on public.team_standings(tournament_id);
create index if not exists idx_team_standings_team on public.team_standings(team_id);

alter table public.team_standings enable row level security;
create policy "public read team standings" on public.team_standings for select using (true);
