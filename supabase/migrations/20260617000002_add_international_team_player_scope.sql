alter table public.teams
  alter column fan_site_host drop not null,
  add column if not exists is_lck_team boolean not null default true,
  add column if not exists imported_scope text not null default 'lck'
    check (imported_scope in ('lck', 'international_event', 'manual')),
  add column if not exists is_active boolean not null default true;

create index if not exists idx_teams_is_lck_team on public.teams(is_lck_team);
create index if not exists idx_teams_imported_scope on public.teams(imported_scope);

alter table public.players
  add column if not exists is_lck_player boolean not null default true,
  add column if not exists imported_scope text not null default 'lck'
    check (imported_scope in ('lck', 'international_event', 'manual')),
  add column if not exists is_active boolean not null default true;

create index if not exists idx_players_is_lck_player on public.players(is_lck_player);
create index if not exists idx_players_imported_scope on public.players(imported_scope);
