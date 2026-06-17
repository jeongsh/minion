alter table public.sets
  add column if not exists blue_rift_heralds integer,
  add column if not exists red_rift_heralds integer,
  add column if not exists blue_void_grubs integer,
  add column if not exists red_void_grubs integer;
