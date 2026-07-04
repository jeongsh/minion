alter table public.set_result_snapshots
  add column if not exists timeline_sync_status text not null default 'pending',
  add column if not exists timeline_sync_attempts integer not null default 0,
  add column if not exists timeline_retry_at timestamptz,
  add column if not exists timeline_last_error text,
  add column if not exists timeline_synced_at timestamptz,
  add column if not exists timeline_event_count integer not null default 0;

alter table public.set_result_snapshots
  drop constraint if exists set_result_snapshots_timeline_sync_status_check;

alter table public.set_result_snapshots
  add constraint set_result_snapshots_timeline_sync_status_check
  check (timeline_sync_status in (
    'pending',
    'waiting_for_source',
    'rate_limited',
    'failed',
    'succeeded'
  ));

update public.set_result_snapshots as snapshot
set timeline_sync_status = 'succeeded',
    timeline_synced_at = now(),
    timeline_event_count = source.event_count
from (
  select set_id, count(*)::integer as event_count
  from public.timeline_events
  group by set_id
) as source
where source.set_id = snapshot.set_id;

create index if not exists idx_set_result_snapshots_timeline_pending
  on public.set_result_snapshots(timeline_retry_at, created_at)
  where timeline_sync_status <> 'succeeded';
