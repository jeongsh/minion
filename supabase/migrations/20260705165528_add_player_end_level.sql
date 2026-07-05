alter table public.set_player_stats
  add column if not exists champion_level smallint
  check (champion_level between 1 and 18);
