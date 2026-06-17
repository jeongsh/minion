-- LCK Hub schema for Supabase.
-- Keep this file aligned with remote migrations and seed data.
-- New public tables should use explicit GRANT statements and RLS policies.

create extension if not exists pgcrypto with schema extensions;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  logo_url text,
  logo_white_url text,
  profile_image_url text,
  primary_color text not null,
  secondary_color text not null,
  background_url text,
  fan_site_host text unique check (
    fan_site_host in ('t1', 'geng', 'hle', 'dk', 'kt', 'drx', 'ns', 'bro', 'fox', 'soop')
  ),
  official_homepage_url text,
  official_youtube_url text,
  official_x_url text,
  official_instagram_url text,
  leaguepedia_page text,
  source_team_id text,
  is_lck_team boolean not null default true,
  imported_scope text not null default 'lck' check (imported_scope in ('lck', 'international_event', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.team_identity_histories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  short_name text not null,
  slug text not null,
  logo_url text,
  sponsor_name text,
  effective_from date not null,
  effective_to date,
  note text,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  real_name text,
  team_id uuid references public.teams(id) on delete set null,
  position text not null check (position in ('TOP', 'JGL', 'MID', 'BOT', 'SUP')),
  profile_image_url text,
  stream_url text,
  twitter_url text,
  instagram_url text,
  youtube_url text,
  facebook_url text,
  discord_url text,
  solo_queue_account text,
  nationality text,
  birth_date date,
  leaguepedia_page text,
  source_player_id text,
  riot_puuid text,
  riot_game_name text,
  riot_tagline text,
  is_starter boolean not null default false,
  is_lck_player boolean not null default true,
  imported_scope text not null default 'lck' check (imported_scope in ('lck', 'international_event', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season integer not null,
  category text not null,
  region text,
  league text,
  split text,
  start_date date,
  end_date date,
  source text,
  source_tournament_id text,
  created_at timestamptz not null default now()
);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete set null,
  stage_id uuid references public.stages(id) on delete set null,
  name text not null,
  match_date timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed')),
  team_a_id uuid references public.teams(id) on delete set null,
  team_b_id uuid references public.teams(id) on delete set null,
  team_a_score integer,
  team_b_score integer,
  best_of integer,
  winner_team_id uuid references public.teams(id) on delete set null,
  official_pom_player_id uuid references public.players(id) on delete set null,
  leaguepedia_match_id text,
  venue text,
  vod_url text,
  created_at timestamptz not null default now()
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  set_number integer not null,
  winner_team_id uuid references public.teams(id) on delete set null,
  blue_team_id uuid references public.teams(id) on delete set null,
  red_team_id uuid references public.teams(id) on delete set null,
  duration_seconds integer,
  blue_kills integer,
  red_kills integer,
  blue_gold integer,
  red_gold integer,
  blue_dragons integer,
  red_dragons integer,
  blue_clouds integer,
  red_clouds integer,
  blue_infernals integer,
  red_infernals integer,
  blue_mountains integer,
  red_mountains integer,
  blue_oceans integer,
  red_oceans integer,
  blue_hextechs integer,
  red_hextechs integer,
  blue_chemtechs integer,
  red_chemtechs integer,
  blue_elders integer,
  red_elders integer,
  blue_rift_heralds integer,
  red_rift_heralds integer,
  blue_void_grubs integer,
  red_void_grubs integer,
  blue_barons integer,
  red_barons integer,
  blue_towers integer,
  red_towers integer,
  patch text,
  leaguepedia_game_id text,
  riot_match_id text,
  riot_platform_game_id text,
  created_at timestamptz not null default now(),
  unique (match_id, set_number)
);

create table public.champions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  image_url text,
  ddragon_id text,
  ddragon_key text,
  ddragon_version text,
  created_at timestamptz not null default now()
);

create table public.set_picks_bans (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  phase text not null,
  action_type text not null check (action_type in ('pick', 'ban')),
  order_index integer not null,
  team_id uuid references public.teams(id) on delete set null,
  champion_id uuid references public.champions(id) on delete set null,
  side text check (side in ('blue', 'red')),
  created_at timestamptz not null default now()
);

create table public.set_player_stats (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  side text check (side in ('blue', 'red')),
  position text not null check (position in ('TOP', 'JGL', 'MID', 'BOT', 'SUP')),
  champion_id uuid references public.champions(id) on delete set null,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  cs integer not null default 0,
  gold integer not null default 0,
  damage_to_champions integer not null default 0,
  vision_score integer not null default 0,
  wards_placed integer not null default 0,
  wards_killed integer not null default 0,
  dpm numeric(8, 2),
  damage_share numeric(8, 6),
  vision_score_per_minute numeric(8, 3),
  cs_per_minute numeric(8, 3),
  gold_diff_at_10 numeric(8, 2),
  xp_diff_at_10 numeric(8, 2),
  cs_diff_at_10 numeric(8, 2),
  gold_diff_at_15 numeric(8, 2),
  xp_diff_at_15 numeric(8, 2),
  cs_diff_at_15 numeric(8, 2),
  item0 integer,
  item1 integer,
  item2 integer,
  item3 integer,
  item4 integer,
  item5 integer,
  item6 integer,
  spell0 integer,
  spell1 integer,
  rune0 integer,
  rune1 integer,
  created_at timestamptz not null default now(),
  unique (set_id, player_id)
);

create table public.set_team_stats (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  kills integer not null default 0,
  deaths integer not null default 0,
  assists integer not null default 0,
  total_gold integer not null default 0,
  total_cs integer not null default 0,
  total_damage integer not null default 0,
  vision_score integer not null default 0,
  dragons integer not null default 0,
  barons integer not null default 0,
  heralds integer not null default 0,
  void_grubs integer not null default 0,
  towers integer not null default 0,
  inhibitors integer not null default 0,
  created_at timestamptz not null default now(),
  unique (set_id, team_id)
);

create table public.fan_ratings (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  rating numeric(2, 1) not null check (rating >= 1 and rating <= 5),
  review text,
  created_at timestamptz not null default now()
);

create table public.fan_pog_votes (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.sets(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (set_id, author_id)
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  board_type text not null,
  site_scope text not null check (site_scope in ('hub', 'team')),
  title text not null,
  content text not null,
  author_id uuid references auth.users(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  set_id uuid references public.sets(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  champion_id uuid references public.champions(id) on delete set null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  content text not null,
  like_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.team_social_posts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  platform text not null,
  title text not null,
  content text,
  source_url text not null,
  thumbnail_url text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.team_videos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  platform text not null,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  published_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.player_broadcasts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  platform text not null,
  stream_url text not null,
  title text,
  is_live boolean not null default false,
  viewer_count integer,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.derived_player_stats (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete cascade,
  period_key text not null,
  games integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  kda numeric(8, 2),
  kp numeric(6, 2),
  dpm numeric(8, 2),
  dmg_percent numeric(6, 2),
  csm numeric(6, 2),
  gpm numeric(8, 2),
  vision_score_avg numeric(8, 2),
  form_score numeric(6, 2),
  radar_growth numeric(6, 2),
  radar_fight numeric(6, 2),
  radar_damage numeric(6, 2),
  radar_survival numeric(6, 2),
  radar_vision numeric(6, 2),
  radar_efficiency numeric(6, 2),
  created_at timestamptz not null default now(),
  unique (player_id, tournament_id, stage_id, period_key)
);

create table public.team_standings (
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

create index idx_team_standings_tournament on public.team_standings(tournament_id);
create index idx_team_standings_team on public.team_standings(team_id);

alter table public.team_standings enable row level security;
create policy "public read team standings" on public.team_standings for select using (true);

create table public.team_awards (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  year integer not null,
  tournament_name text not null,
  award_type text not null check (award_type in (
    'lck_champion', 'lck_runner_up',
    'worlds_champion', 'worlds_runner_up',
    'msi_champion', 'msi_runner_up',
    'first_stand_champion', 'first_stand_runner_up',
    'ewc_champion', 'ewc_runner_up',
    'lck_finals_mvp', 'worlds_mvp', 'msi_mvp',
    'all_lck_first', 'all_lck_second',
    'rookie_of_year'
  )),
  player_id uuid references public.players(id) on delete set null,
  player_name text,
  notes text,
  source text not null default 'leaguepedia',
  leaguepedia_page text,
  created_at timestamptz not null default now()
);

create index idx_team_awards_team_id on public.team_awards(team_id);
create index idx_team_awards_year on public.team_awards(year desc);
create index idx_team_awards_type on public.team_awards(award_type);

alter table public.team_awards enable row level security;
create policy "public read team awards" on public.team_awards for select using (true);

grant select on public.team_awards to anon, authenticated;
grant all on public.team_awards to service_role;

create table public.derived_team_stats (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  stage_id uuid references public.stages(id) on delete cascade,
  period_key text not null,
  matches integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  avg_kills numeric(8, 2),
  avg_deaths numeric(8, 2),
  avg_gold numeric(10, 2),
  avg_cs numeric(10, 2),
  dragon_rate numeric(6, 2),
  baron_rate numeric(6, 2),
  avg_towers numeric(8, 2),
  avg_dpm numeric(10, 2),
  avg_vision_score numeric(8, 2),
  radar_fight numeric(6, 2),
  radar_damage numeric(6, 2),
  radar_growth numeric(6, 2),
  radar_vision numeric(6, 2),
  radar_objective numeric(6, 2),
  radar_stability numeric(6, 2),
  created_at timestamptz not null default now(),
  unique (team_id, tournament_id, stage_id, period_key)
);

create table public.match_timeline_frames (
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

create table public.timeline_events (
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

create table public.soloq_accounts (
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

create table public.soloq_rank_snapshots (
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

create table public.soloq_matches (
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

create table public.champion_stats_pro (
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

create table public.data_dragon_versions (
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

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text,
  license text,
  description text,
  created_at timestamptz not null default now()
);

create index idx_players_team_id on public.players(team_id);
create index idx_stages_tournament_id on public.stages(tournament_id);
create index idx_matches_tournament_id on public.matches(tournament_id);
create index idx_matches_stage_id on public.matches(stage_id);
create index idx_matches_match_date on public.matches(match_date);
create index idx_matches_team_a on public.matches(team_a_id);
create index idx_matches_team_b on public.matches(team_b_id);
create index idx_matches_winner_team_id on public.matches(winner_team_id);
create index idx_matches_official_pom_player_id on public.matches(official_pom_player_id);
create index idx_matches_leaguepedia_match_id on public.matches(leaguepedia_match_id);
create index idx_team_identity_histories_team_id on public.team_identity_histories(team_id);
create index idx_team_identity_histories_effective_from on public.team_identity_histories(effective_from);
create index idx_sets_match_id on public.sets(match_id);
create index idx_sets_winner_team_id on public.sets(winner_team_id);
create index idx_sets_blue_team_id on public.sets(blue_team_id);
create index idx_sets_red_team_id on public.sets(red_team_id);
create index idx_sets_riot_match_id on public.sets(riot_match_id);
create index idx_sets_leaguepedia_game_id on public.sets(leaguepedia_game_id);
create index idx_set_picks_bans_set_id on public.set_picks_bans(set_id);
create index idx_set_picks_bans_team_id on public.set_picks_bans(team_id);
create index idx_set_picks_bans_champion_id on public.set_picks_bans(champion_id);
create index idx_set_player_stats_player_id on public.set_player_stats(player_id);
create index idx_set_player_stats_team_id on public.set_player_stats(team_id);
create index idx_set_player_stats_champion_id on public.set_player_stats(champion_id);
create index idx_set_team_stats_team_id on public.set_team_stats(team_id);
create index idx_posts_scope_board on public.community_posts(site_scope, board_type);
create index idx_posts_team_id on public.community_posts(team_id);
create index idx_posts_author_id on public.community_posts(author_id);
create index idx_posts_match_id on public.community_posts(match_id);
create index idx_posts_set_id on public.community_posts(set_id);
create index idx_posts_player_id on public.community_posts(player_id);
create index idx_posts_champion_id on public.community_posts(champion_id);
create index idx_comments_post_id on public.community_comments(post_id);
create index idx_comments_author_id on public.community_comments(author_id);
create index idx_fan_ratings_match_id on public.fan_ratings(match_id);
create index idx_fan_ratings_set_id on public.fan_ratings(set_id);
create index idx_fan_ratings_player_id on public.fan_ratings(player_id);
create index idx_fan_ratings_team_id on public.fan_ratings(team_id);
create index idx_fan_ratings_author_id on public.fan_ratings(author_id);
create index idx_fan_pog_votes_match_id on public.fan_pog_votes(match_id);
create index idx_fan_pog_votes_player_id on public.fan_pog_votes(player_id);
create index idx_fan_pog_votes_team_id on public.fan_pog_votes(team_id);
create index idx_fan_pog_votes_author_id on public.fan_pog_votes(author_id);
create index idx_team_social_posts_team_id on public.team_social_posts(team_id);
create index idx_team_videos_team_id on public.team_videos(team_id);
create index idx_player_broadcasts_player_id on public.player_broadcasts(player_id);
create index idx_player_broadcasts_team_id on public.player_broadcasts(team_id);
create index idx_derived_player_stats_tournament_id on public.derived_player_stats(tournament_id);
create index idx_derived_player_stats_stage_id on public.derived_player_stats(stage_id);
create index idx_derived_team_stats_tournament_id on public.derived_team_stats(tournament_id);
create index idx_derived_team_stats_stage_id on public.derived_team_stats(stage_id);
create index idx_match_timeline_frames_set_id on public.match_timeline_frames(set_id);
create index idx_timeline_events_set_id on public.timeline_events(set_id);
create index idx_timeline_events_team_id on public.timeline_events(team_id);
create index idx_timeline_events_player_id on public.timeline_events(player_id);
create index idx_timeline_events_killer_player_id on public.timeline_events(killer_player_id);
create index idx_timeline_events_victim_player_id on public.timeline_events(victim_player_id);
create index idx_soloq_accounts_player_id on public.soloq_accounts(player_id);
create index idx_soloq_rank_snapshots_account_id on public.soloq_rank_snapshots(soloq_account_id);
create index idx_soloq_matches_account_id on public.soloq_matches(soloq_account_id);
create index idx_soloq_matches_champion_id on public.soloq_matches(champion_id);
create index idx_champion_stats_pro_champion_id on public.champion_stats_pro(champion_id);
create index idx_champion_stats_pro_tournament_id on public.champion_stats_pro(tournament_id);
create index idx_teams_is_lck_team on public.teams(is_lck_team);
create index idx_teams_imported_scope on public.teams(imported_scope);
create index idx_players_is_lck_player on public.players(is_lck_player);
create index idx_players_imported_scope on public.players(imported_scope);

alter table public.teams enable row level security;
alter table public.team_identity_histories enable row level security;
alter table public.players enable row level security;
alter table public.tournaments enable row level security;
alter table public.stages enable row level security;
alter table public.matches enable row level security;
alter table public.sets enable row level security;
alter table public.champions enable row level security;
alter table public.set_picks_bans enable row level security;
alter table public.set_player_stats enable row level security;
alter table public.set_team_stats enable row level security;
alter table public.fan_ratings enable row level security;
alter table public.fan_pog_votes enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.team_social_posts enable row level security;
alter table public.team_videos enable row level security;
alter table public.player_broadcasts enable row level security;
alter table public.derived_player_stats enable row level security;
alter table public.derived_team_stats enable row level security;
alter table public.match_timeline_frames enable row level security;
alter table public.timeline_events enable row level security;
alter table public.soloq_accounts enable row level security;
alter table public.soloq_rank_snapshots enable row level security;
alter table public.soloq_matches enable row level security;
alter table public.champion_stats_pro enable row level security;
alter table public.data_dragon_versions enable row level security;
alter table public.data_sources enable row level security;

grant usage on schema public to anon, authenticated;

grant select on
  public.teams,
  public.team_identity_histories,
  public.players,
  public.tournaments,
  public.stages,
  public.matches,
  public.sets,
  public.champions,
  public.set_picks_bans,
  public.set_player_stats,
  public.set_team_stats,
  public.team_social_posts,
  public.team_videos,
  public.player_broadcasts,
  public.derived_player_stats,
  public.derived_team_stats,
  public.match_timeline_frames,
  public.timeline_events,
  public.soloq_accounts,
  public.soloq_rank_snapshots,
  public.soloq_matches,
  public.champion_stats_pro,
  public.data_dragon_versions,
  public.data_sources
to anon, authenticated;

grant select on
  public.fan_ratings,
  public.fan_pog_votes,
  public.community_posts,
  public.community_comments
to anon, authenticated;

grant insert on
  public.fan_ratings,
  public.fan_pog_votes,
  public.community_posts,
  public.community_comments
to authenticated;

grant update on
  public.community_posts,
  public.community_comments
to authenticated;

grant all on all tables in schema public to service_role;

create policy "public read teams" on public.teams for select using (true);
create policy "public read team identity histories" on public.team_identity_histories for select using (true);
create policy "public read players" on public.players for select using (true);
create policy "public read tournaments" on public.tournaments for select using (true);
create policy "public read stages" on public.stages for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read sets" on public.sets for select using (true);
create policy "public read champions" on public.champions for select using (true);
create policy "public read picks bans" on public.set_picks_bans for select using (true);
create policy "public read set player stats" on public.set_player_stats for select using (true);
create policy "public read set team stats" on public.set_team_stats for select using (true);
create policy "public read team social posts" on public.team_social_posts for select using (true);
create policy "public read team videos" on public.team_videos for select using (true);
create policy "public read player broadcasts" on public.player_broadcasts for select using (true);
create policy "public read derived player stats" on public.derived_player_stats for select using (true);
create policy "public read derived team stats" on public.derived_team_stats for select using (true);
create policy "public read match timeline frames" on public.match_timeline_frames for select using (true);
create policy "public read timeline events" on public.timeline_events for select using (true);
create policy "public read soloq accounts" on public.soloq_accounts for select using (true);
create policy "public read soloq rank snapshots" on public.soloq_rank_snapshots for select using (true);
create policy "public read soloq matches" on public.soloq_matches for select using (true);
create policy "public read champion stats pro" on public.champion_stats_pro for select using (true);
create policy "public read data dragon versions" on public.data_dragon_versions for select using (true);
create policy "public read data sources" on public.data_sources for select using (true);

create policy "public read fan ratings" on public.fan_ratings for select using (true);
create policy "authenticated insert fan ratings" on public.fan_ratings
  for insert to authenticated with check ((select auth.uid()) = author_id);

create policy "public read fan pog votes" on public.fan_pog_votes for select using (true);
create policy "authenticated insert fan pog votes" on public.fan_pog_votes
  for insert to authenticated with check ((select auth.uid()) = author_id);

create policy "public read community posts" on public.community_posts for select using (true);
create policy "authenticated insert community posts" on public.community_posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "authors update community posts" on public.community_posts
  for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

create policy "public read community comments" on public.community_comments for select using (true);
create policy "authenticated insert community comments" on public.community_comments
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "authors update community comments" on public.community_comments
  for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);

revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
