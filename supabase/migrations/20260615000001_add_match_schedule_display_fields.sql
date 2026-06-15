alter table public.matches
  add column if not exists venue text,
  add column if not exists vod_url text;
