alter table public.sets
  add column if not exists status text not null default 'scheduled';

alter table public.sets
  drop constraint if exists sets_status_check;

alter table public.sets
  add constraint sets_status_check
  check (status in (
    'scheduled',
    'draft_in_progress',
    'draft_done',
    'finished',
    'data_synced'
  ));

update public.sets
set status = case
  when winner_team_id is not null then 'finished'
  when exists (
    select 1
    from public.set_picks_bans
    where set_picks_bans.set_id = sets.id
  ) then 'draft_done'
  else 'scheduled'
end
where status = 'scheduled';

create index if not exists idx_sets_status on public.sets(status);

create or replace function public.set_sets_result_recorded_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('finished', 'data_synced')
    and (TG_OP = 'INSERT' or old.status not in ('finished', 'data_synced'))
    and new.result_recorded_at is null then
    new.result_recorded_at = now();
  end if;

  if new.status not in ('finished', 'data_synced') then
    new.result_recorded_at = null;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
