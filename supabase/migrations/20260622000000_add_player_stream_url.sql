alter table public.players
  add column if not exists stream_url text;
