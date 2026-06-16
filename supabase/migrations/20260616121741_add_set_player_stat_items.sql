alter table public.set_player_stats
  add column if not exists item0 integer,
  add column if not exists item1 integer,
  add column if not exists item2 integer,
  add column if not exists item3 integer,
  add column if not exists item4 integer,
  add column if not exists item5 integer,
  add column if not exists item6 integer;
