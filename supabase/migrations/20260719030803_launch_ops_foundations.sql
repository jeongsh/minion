-- Launch ops foundations: fan alerts, upload tracking, audit logs, and advisor fixes.

create table if not exists public.fan_notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  match_alerts boolean not null default true,
  news_alerts boolean not null default true,
  roster_alerts boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create index if not exists idx_fan_notification_subscriptions_team_id
  on public.fan_notification_subscriptions(team_id);

alter table public.fan_notification_subscriptions enable row level security;

drop policy if exists "users read own fan notification subscriptions" on public.fan_notification_subscriptions;
create policy "users read own fan notification subscriptions"
  on public.fan_notification_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own fan notification subscriptions" on public.fan_notification_subscriptions;
create policy "users insert own fan notification subscriptions"
  on public.fan_notification_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "users update own fan notification subscriptions" on public.fan_notification_subscriptions;
create policy "users update own fan notification subscriptions"
  on public.fan_notification_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "users delete own fan notification subscriptions" on public.fan_notification_subscriptions;
create policy "users delete own fan notification subscriptions"
  on public.fan_notification_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.fan_notification_subscriptions to authenticated;

create table if not exists public.community_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  public_url text not null,
  original_content_type text not null,
  stored_content_type text not null,
  original_bytes integer not null check (original_bytes > 0),
  stored_bytes integer not null check (stored_bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'attached', 'deleted')),
  created_at timestamptz not null default now(),
  attached_at timestamptz,
  deleted_at timestamptz,
  unique (bucket_id, object_path)
);

create index if not exists idx_community_uploads_user_id_created_at
  on public.community_uploads(user_id, created_at desc);
create index if not exists idx_community_uploads_status_created_at
  on public.community_uploads(status, created_at);

alter table public.community_uploads enable row level security;

drop policy if exists "users read own community uploads" on public.community_uploads;
create policy "users read own community uploads"
  on public.community_uploads for select
  to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.community_uploads to authenticated;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_event_type_created_at
  on public.admin_audit_logs(event_type, created_at desc);
create index if not exists idx_admin_audit_logs_actor_user_id_created_at
  on public.admin_audit_logs(actor_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "deny client reads admin audit logs" on public.admin_audit_logs;
create policy "deny client reads admin audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using (false);

alter function public.adjust_team_popularity(uuid, integer) set search_path = public;
alter function public.set_sets_result_recorded_at() set search_path = public;

create index if not exists idx_celebration_messages_author_id
  on public.celebration_messages(author_id);
create index if not exists idx_fan_calendar_events_player_id
  on public.fan_calendar_events(player_id);
create index if not exists idx_player_career_history_team_id
  on public.player_career_history(team_id);
create index if not exists idx_team_awards_player_id
  on public.team_awards(player_id);
