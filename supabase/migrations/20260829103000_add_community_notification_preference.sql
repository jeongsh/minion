alter table public.user_notification_preferences
  add column if not exists community_enabled boolean not null default true;

notify pgrst, 'reload schema';
