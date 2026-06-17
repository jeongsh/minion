alter table public.set_player_stats
  drop column if exists rune2,
  drop column if exists rune3,
  drop column if exists rune4,
  drop column if exists rune5;
