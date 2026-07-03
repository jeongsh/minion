alter table public.match_automation_events
  drop constraint if exists match_automation_events_event_type_check;

alter table public.match_automation_events
  add constraint match_automation_events_event_type_check
  check (event_type in (
    'set_rating_opened',
    'match_completed',
    'set_data_sync_succeeded',
    'set_data_sync_failed'
  ));
