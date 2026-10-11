-- Each season is one bounded, atomically replaced public document snapshot.
-- Manual records live in a separate column and are never overwritten by imports.
create table public.lck_transfer_markets (
  season integer primary key check (season between 2020 and 2100),
  snapshot jsonb not null check (coalesce(jsonb_typeof(snapshot) = 'object' and snapshot->>'version' = '1' and (snapshot->>'season')::integer = season and jsonb_typeof(snapshot->'rosters') = 'array' and jsonb_array_length(snapshot->'rosters') = 10 and jsonb_typeof(snapshot->'events') = 'array' and jsonb_typeof(snapshot->'faCandidates') = 'array', false)),
  manual_events jsonb not null default '[]'::jsonb check (jsonb_typeof(manual_events) = 'array'),
  content_hash text not null,
  checked_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  auto_sync boolean not null default true,
  constraint lck_transfer_snapshot_size check (octet_length(snapshot::text) <= 1000000),
  constraint lck_transfer_manual_size check (octet_length(manual_events::text) <= 1000000)
);
alter table public.lck_transfer_markets enable row level security;
revoke all on public.lck_transfer_markets from anon, authenticated;
grant select on public.lck_transfer_markets to anon, authenticated;
grant select, insert, update, delete on public.lck_transfer_markets to service_role;
create policy lck_transfer_markets_public_read on public.lck_transfer_markets
  for select to anon, authenticated using (true);
comment on table public.lck_transfer_markets is 'LCK offseason snapshots; ingestion never changes players.team_id or current match rosters.';
