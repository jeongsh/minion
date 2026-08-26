alter table public.match_automation_events
  add column if not exists push_delivered_at timestamptz;
