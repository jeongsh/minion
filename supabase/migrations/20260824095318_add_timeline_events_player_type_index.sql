create index if not exists idx_timeline_events_set_player_type
  on public.timeline_events(set_id, player_id, event_type);
