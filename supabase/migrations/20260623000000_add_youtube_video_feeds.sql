alter table public.teams
  add column if not exists official_youtube_channel_id text;

alter table public.players
  add column if not exists youtube_channel_id text;

alter table public.team_videos
  add column if not exists youtube_video_id text,
  add column if not exists embed_url text,
  add column if not exists is_new boolean not null default true,
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now();

create unique index if not exists idx_team_videos_youtube_video_id
  on public.team_videos(youtube_video_id)
  where youtube_video_id is not null;

create index if not exists idx_team_videos_published_at
  on public.team_videos(published_at desc);

create index if not exists idx_team_videos_is_new
  on public.team_videos(is_new)
  where is_new = true;

create table if not exists public.player_videos (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  platform text not null default 'youtube' check (platform in ('youtube')),
  title text not null,
  video_url text not null,
  youtube_video_id text,
  embed_url text,
  thumbnail_url text,
  published_at timestamptz,
  view_count integer not null default 0,
  is_new boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_player_videos_youtube_video_id
  on public.player_videos(youtube_video_id)
  where youtube_video_id is not null;

create index if not exists idx_player_videos_player_id
  on public.player_videos(player_id);

create index if not exists idx_player_videos_team_id
  on public.player_videos(team_id);

create index if not exists idx_player_videos_published_at
  on public.player_videos(published_at desc);

create index if not exists idx_player_videos_is_new
  on public.player_videos(is_new)
  where is_new = true;

alter table public.player_videos enable row level security;

grant select on public.player_videos to anon, authenticated;
grant all on public.player_videos to service_role;

drop policy if exists "public read player videos" on public.player_videos;
create policy "public read player videos" on public.player_videos
  for select using (true);
