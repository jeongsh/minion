-- Fan temperature + temporary onion vent board.
-- The onion body is intentionally short-lived: active rows are visible for 5 minutes,
-- then a cron job physically deletes them. Application/server logs and backups can
-- still exist outside this table, so the app copy should not promise absolute erasure.

create extension if not exists pg_cron;

create table if not exists public.fan_temperature_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  voter_key text not null,
  event_type text not null default 'heat',
  weight integer not null default 1,
  created_at timestamptz not null default now(),
  constraint fan_temperature_events_type_chk check (event_type in ('heat')),
  constraint fan_temperature_events_weight_chk check (weight between 1 and 5)
);

create index if not exists idx_fan_temperature_events_team_created
  on public.fan_temperature_events(team_id, created_at desc);
create index if not exists idx_fan_temperature_events_voter_created
  on public.fan_temperature_events(voter_key, created_at desc);

create table if not exists public.fan_onions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  voter_key text not null,
  content text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  constraint fan_onions_content_len_chk check (char_length(btrim(content)) between 1 and 100)
);

create index if not exists idx_fan_onions_team_active
  on public.fan_onions(team_id, expires_at desc, created_at desc);
create index if not exists idx_fan_onions_voter_created
  on public.fan_onions(voter_key, created_at desc);

alter table public.fan_temperature_events enable row level security;
alter table public.fan_onions enable row level security;

revoke all on public.fan_temperature_events from public, anon, authenticated;
revoke all on public.fan_onions from public, anon, authenticated;

drop policy if exists "public read active fan onions" on public.fan_onions;
create policy "public read active fan onions" on public.fan_onions
  for select using (expires_at > now());

grant select on public.fan_onions to anon, authenticated;
grant all on public.fan_temperature_events to service_role;
grant all on public.fan_onions to service_role;

create or replace function public.cleanup_expired_fan_onions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.fan_onions
  where expires_at <= now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.cleanup_expired_fan_onions() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-fan-onions') then
    perform cron.unschedule('cleanup-expired-fan-onions');
  end if;
end $$;

select cron.schedule(
  'cleanup-expired-fan-onions',
  '* * * * *',
  $$select public.cleanup_expired_fan_onions();$$
);
