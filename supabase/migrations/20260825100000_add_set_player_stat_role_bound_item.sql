alter table public.set_player_stats
  add column if not exists role_bound_item integer;
