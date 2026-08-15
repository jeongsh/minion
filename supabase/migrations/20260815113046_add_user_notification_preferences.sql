create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  in_app_enabled boolean not null default true,
  match_start_enabled boolean not null default true,
  match_events_enabled boolean not null default false,
  rating_open_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

create policy "users read own notification preferences"
  on public.user_notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users insert own notification preferences"
  on public.user_notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users update own notification preferences"
  on public.user_notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.user_notification_preferences to authenticated;
