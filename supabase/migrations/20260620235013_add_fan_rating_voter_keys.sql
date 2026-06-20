alter table public.fan_ratings
  add column if not exists voter_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_ratings_set_player_voter_key_unique'
      and conrelid = 'public.fan_ratings'::regclass
  ) then
    alter table public.fan_ratings
      add constraint fan_ratings_set_player_voter_key_unique
      unique (set_id, player_id, voter_key);
  end if;
end $$;

create index if not exists idx_fan_ratings_set_voter_key
  on public.fan_ratings(set_id, voter_key);

notify pgrst, 'reload schema';
