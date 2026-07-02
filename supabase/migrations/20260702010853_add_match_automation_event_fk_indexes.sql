create index if not exists idx_match_automation_events_match_id
  on public.match_automation_events(match_id);

create index if not exists idx_match_automation_events_set_id
  on public.match_automation_events(set_id);
