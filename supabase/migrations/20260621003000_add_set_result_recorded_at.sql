alter table public.sets
  add column if not exists result_recorded_at timestamptz;

create index if not exists idx_sets_result_recorded_at
  on public.sets(result_recorded_at);

create or replace function public.set_sets_result_recorded_at()
returns trigger
language plpgsql
as $$
begin
  if new.winner_team_id is not null
    and (TG_OP = 'INSERT' or old.winner_team_id is null)
    and new.result_recorded_at is null then
    new.result_recorded_at = now();
  end if;

  if new.winner_team_id is null then
    new.result_recorded_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_sets_result_recorded_at on public.sets;
create trigger set_sets_result_recorded_at
before insert or update on public.sets
for each row
execute function public.set_sets_result_recorded_at();

update public.sets
set result_recorded_at = now()
where winner_team_id is not null
  and result_recorded_at is null;

notify pgrst, 'reload schema';
