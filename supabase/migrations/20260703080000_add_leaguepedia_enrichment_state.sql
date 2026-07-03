alter table public.set_result_snapshots
  add column if not exists leaguepedia_sync_status text not null default 'pending',
  add column if not exists leaguepedia_sync_attempts integer not null default 0,
  add column if not exists leaguepedia_retry_at timestamptz,
  add column if not exists leaguepedia_last_error text,
  add column if not exists leaguepedia_synced_at timestamptz;

alter table public.set_result_snapshots
  drop constraint if exists set_result_snapshots_leaguepedia_sync_status_check;

alter table public.set_result_snapshots
  add constraint set_result_snapshots_leaguepedia_sync_status_check
  check (leaguepedia_sync_status in ('pending', 'rate_limited', 'failed', 'succeeded'));

create index if not exists idx_set_result_snapshots_leaguepedia_pending
  on public.set_result_snapshots(leaguepedia_retry_at, created_at)
  where leaguepedia_sync_status <> 'succeeded';

alter table public.match_automation_events
  drop constraint if exists match_automation_events_event_type_check;

alter table public.match_automation_events
  add constraint match_automation_events_event_type_check
  check (event_type in (
    'set_rating_opened',
    'match_completed',
    'set_data_sync_succeeded',
    'set_data_sync_failed',
    'set_data_sync_rate_limited'
  ));
