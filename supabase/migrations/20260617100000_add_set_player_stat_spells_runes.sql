alter table public.set_player_stats
  add column if not exists spell0 integer,
  add column if not exists spell1 integer,
  add column if not exists rune0 integer,
  add column if not exists rune1 integer,
  add column if not exists rune2 integer,
  add column if not exists rune3 integer,
  add column if not exists rune4 integer,
  add column if not exists rune5 integer;
