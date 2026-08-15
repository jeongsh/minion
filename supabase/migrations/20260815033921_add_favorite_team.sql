-- A profile can have many followed teams, but exactly one optional favorite team.
alter table public.profiles
  add column if not exists favorite_team_id uuid references public.teams(id) on delete set null;

create index if not exists profiles_favorite_team_id_idx
  on public.profiles (favorite_team_id)
  where favorite_team_id is not null;
