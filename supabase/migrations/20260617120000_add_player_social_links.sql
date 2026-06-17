alter table public.players
  add column if not exists twitter_url text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists facebook_url text,
  add column if not exists discord_url text;

insert into storage.buckets (id, name, public)
values ('player-profiles', 'player-profiles', true)
on conflict (id) do update set public = true;

create policy "public read player profile images"
  on storage.objects
  for select
  using (bucket_id = 'player-profiles');
