alter table public.set_player_stats
  add column if not exists full_rune_names text[];
