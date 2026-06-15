alter table public.teams
  add column if not exists leaguepedia_page text,
  add column if not exists source_team_id text;

alter table public.players
  add column if not exists nationality text,
  add column if not exists birth_date date,
  add column if not exists leaguepedia_page text,
  add column if not exists source_player_id text,
  add column if not exists riot_puuid text,
  add column if not exists riot_game_name text,
  add column if not exists riot_tagline text;

alter table public.tournaments
  add column if not exists region text,
  add column if not exists league text,
  add column if not exists split text,
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists source text,
  add column if not exists source_tournament_id text;

alter table public.matches
  add column if not exists best_of integer,
  add column if not exists winner_team_id uuid references public.teams(id) on delete set null,
  add column if not exists leaguepedia_match_id text;

alter table public.sets
  add column if not exists patch text,
  add column if not exists leaguepedia_game_id text,
  add column if not exists riot_match_id text,
  add column if not exists riot_platform_game_id text;

alter table public.champions
  add column if not exists ddragon_id text,
  add column if not exists ddragon_key text,
  add column if not exists ddragon_version text;

alter table public.set_player_stats
  add column if not exists side text check (side in ('blue', 'red')),
  add column if not exists wards_placed integer not null default 0,
  add column if not exists wards_killed integer not null default 0;

create table if not exists public.match_timeline_frames (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  minute integer not null,
  timestamp_ms integer not null,
  blue_total_gold integer,
  red_total_gold integer,
  gold_diff integer,
  blue_total_xp integer,
  red_total_xp integer,
  xp_diff integer,
  blue_total_cs integer,
  red_total_cs integer,
  cs_diff integer,
  created_at timestamptz not null default now(),
  unique (set_id, minute)
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  timestamp_ms integer not null,
  minute integer not null,
  event_type text not null,
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  killer_player_id uuid references public.players(id) on delete set null,
  victim_player_id uuid references public.players(id) on delete set null,
  assist_player_ids uuid[] not null default '{}',
  monster_type text,
  building_type text,
  lane_type text,
  raw_event_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.soloq_accounts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  riot_game_name text not null,
  riot_tagline text not null,
  region text not null default 'KR',
  puuid text,
  summoner_id text,
  account_id text,
  is_primary boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, riot_game_name, riot_tagline, region)
);

create table if not exists public.soloq_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  soloq_account_id uuid not null references public.soloq_accounts(id) on delete cascade,
  queue_type text not null,
  tier text,
  rank text,
  league_points integer,
  wins integer,
  losses integer,
  win_rate numeric(6, 2),
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  unique (soloq_account_id, queue_type, snapshot_date)
);

create table if not exists public.soloq_matches (
  id uuid primary key default gen_random_uuid(),
  soloq_account_id uuid not null references public.soloq_accounts(id) on delete cascade,
  riot_match_id text not null,
  champion_id uuid references public.champions(id) on delete set null,
  role text,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  cs integer not null default 0,
  gold integer not null default 0,
  damage_to_champions integer not null default 0,
  vision_score integer not null default 0,
  win boolean,
  game_start_time timestamptz,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  unique (soloq_account_id, riot_match_id)
);

create table if not exists public.champion_stats_pro (
  id uuid primary key default gen_random_uuid(),
  champion_id uuid not null references public.champions(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  patch text,
  role text,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  pick_rate numeric(6, 2),
  ban_rate numeric(6, 2),
  presence_rate numeric(6, 2),
  kda numeric(8, 2),
  dpm numeric(8, 2),
  gd15 numeric(8, 2),
  csd15 numeric(8, 2),
  xpd15 numeric(8, 2),
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (champion_id, tournament_id, patch, role, source)
);

create table if not exists public.data_dragon_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  language text not null default 'ko_KR',
  champion_json jsonb,
  item_json jsonb,
  summoner_json jsonb,
  rune_json jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_matches_winner_team_id on public.matches(winner_team_id);
create index if not exists idx_matches_leaguepedia_match_id on public.matches(leaguepedia_match_id);
create index if not exists idx_sets_riot_match_id on public.sets(riot_match_id);
create index if not exists idx_sets_leaguepedia_game_id on public.sets(leaguepedia_game_id);
create index if not exists idx_match_timeline_frames_set_id on public.match_timeline_frames(set_id);
create index if not exists idx_timeline_events_set_id on public.timeline_events(set_id);
create index if not exists idx_timeline_events_team_id on public.timeline_events(team_id);
create index if not exists idx_timeline_events_player_id on public.timeline_events(player_id);
create index if not exists idx_timeline_events_killer_player_id on public.timeline_events(killer_player_id);
create index if not exists idx_timeline_events_victim_player_id on public.timeline_events(victim_player_id);
create index if not exists idx_soloq_accounts_player_id on public.soloq_accounts(player_id);
create index if not exists idx_soloq_rank_snapshots_account_id on public.soloq_rank_snapshots(soloq_account_id);
create index if not exists idx_soloq_matches_account_id on public.soloq_matches(soloq_account_id);
create index if not exists idx_soloq_matches_champion_id on public.soloq_matches(champion_id);
create index if not exists idx_champion_stats_pro_champion_id on public.champion_stats_pro(champion_id);
create index if not exists idx_champion_stats_pro_tournament_id on public.champion_stats_pro(tournament_id);

alter table public.match_timeline_frames enable row level security;
alter table public.timeline_events enable row level security;
alter table public.soloq_accounts enable row level security;
alter table public.soloq_rank_snapshots enable row level security;
alter table public.soloq_matches enable row level security;
alter table public.champion_stats_pro enable row level security;
alter table public.data_dragon_versions enable row level security;

grant select on
  public.match_timeline_frames,
  public.timeline_events,
  public.soloq_accounts,
  public.soloq_rank_snapshots,
  public.soloq_matches,
  public.champion_stats_pro,
  public.data_dragon_versions
to anon, authenticated;

grant all on all tables in schema public to service_role;

create policy "public read match timeline frames" on public.match_timeline_frames for select using (true);
create policy "public read timeline events" on public.timeline_events for select using (true);
create policy "public read soloq accounts" on public.soloq_accounts for select using (true);
create policy "public read soloq rank snapshots" on public.soloq_rank_snapshots for select using (true);
create policy "public read soloq matches" on public.soloq_matches for select using (true);
create policy "public read champion stats pro" on public.champion_stats_pro for select using (true);
create policy "public read data dragon versions" on public.data_dragon_versions for select using (true);
