create table if not exists public.set_result_snapshots (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  source text not null default 'lolesports',
  external_event_id text,
  external_match_id text,
  external_game_id text,
  external_game_state text,
  external_team_a_id text,
  external_team_b_id text,
  external_winner_team_id text,
  winner_team_id uuid references public.teams(id) on delete set null,
  set_number integer,
  team_a_score integer,
  team_b_score integer,
  observed_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, source)
);

alter table public.set_result_snapshots enable row level security;

create index if not exists idx_set_result_snapshots_match_id
  on public.set_result_snapshots(match_id);

create index if not exists idx_set_result_snapshots_external_game_id
  on public.set_result_snapshots(external_game_id)
  where external_game_id is not null;

create index if not exists idx_set_result_snapshots_winner_team_id
  on public.set_result_snapshots(winner_team_id);

grant select, insert, update, delete on public.set_result_snapshots to service_role;

comment on table public.set_result_snapshots is
  'Best-effort set result snapshots from the public LoL Esports API. API-derived fields are nullable by design.';
