create table public.leaguepedia_team_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  page_name text not null unique check (btrim(page_name) <> ''),
  created_at timestamptz not null default now()
);

create table public.leaguepedia_player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  page_name text not null unique check (btrim(page_name) <> ''),
  created_at timestamptz not null default now()
);

alter table public.leaguepedia_team_aliases enable row level security;
alter table public.leaguepedia_player_aliases enable row level security;

revoke all on public.leaguepedia_team_aliases from public, anon, authenticated;
revoke all on public.leaguepedia_player_aliases from public, anon, authenticated;
grant all on public.leaguepedia_team_aliases to service_role;
grant all on public.leaguepedia_player_aliases to service_role;

create index idx_leaguepedia_team_aliases_team_id
  on public.leaguepedia_team_aliases(team_id);
create index idx_leaguepedia_player_aliases_player_id
  on public.leaguepedia_player_aliases(player_id);

update public.teams
set source_team_id = 'lp:' || leaguepedia_page
where nullif(source_team_id, '') is null
  and nullif(leaguepedia_page, '') is not null;

update public.players
set source_player_id = 'lp:' || leaguepedia_page
where nullif(source_player_id, '') is null
  and nullif(leaguepedia_page, '') is not null;

insert into public.leaguepedia_team_aliases (team_id, page_name)
select id, leaguepedia_page
from public.teams
where nullif(leaguepedia_page, '') is not null
on conflict (page_name) do nothing;

insert into public.leaguepedia_player_aliases (player_id, page_name)
select id, leaguepedia_page
from public.players
where nullif(leaguepedia_page, '') is not null
on conflict (page_name) do nothing;

-- Leaguepedia uses this disambiguated page ID in match/game tables while
-- existing roster data historically stored the shorter redirect name.
insert into public.leaguepedia_team_aliases (team_id, page_name)
select id, 'LYON (2024 American Team)'
from public.teams
where slug = 'lyon'
on conflict (page_name) do nothing;

create unique index teams_source_team_id_key
  on public.teams(source_team_id)
  where source_team_id is not null and source_team_id <> '';

create unique index players_source_player_id_key
  on public.players(source_player_id)
  where source_player_id is not null and source_player_id <> '';
