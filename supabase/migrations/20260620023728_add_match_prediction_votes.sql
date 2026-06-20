create table if not exists public.fan_match_predictions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  unique (match_id, voter_key)
);

create index if not exists idx_fan_match_predictions_match_id
  on public.fan_match_predictions(match_id);

create index if not exists idx_fan_match_predictions_team_id
  on public.fan_match_predictions(team_id);

alter table public.fan_match_predictions enable row level security;

grant select on public.fan_match_predictions to anon, authenticated;
grant all on public.fan_match_predictions to service_role;

create policy "public read fan match predictions"
  on public.fan_match_predictions for select using (true);

update public.matches
set status = 'completed'
where status <> 'completed'
  and exists (
    select 1
    from public.sets
    where sets.match_id = matches.id
  );
