alter table public.set_player_stats
  add column if not exists dpm numeric(8, 2),
  add column if not exists damage_share numeric(8, 6),
  add column if not exists vision_score_per_minute numeric(8, 3),
  add column if not exists cs_per_minute numeric(8, 3),
  add column if not exists gold_diff_at_10 numeric(8, 2),
  add column if not exists xp_diff_at_10 numeric(8, 2),
  add column if not exists cs_diff_at_10 numeric(8, 2),
  add column if not exists gold_diff_at_15 numeric(8, 2),
  add column if not exists xp_diff_at_15 numeric(8, 2),
  add column if not exists cs_diff_at_15 numeric(8, 2);
