-- Community user safety: personal blocks, user reports, and admin-only sanctions.

create table if not exists public.community_user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint community_user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists idx_community_user_blocks_blocked_id
  on public.community_user_blocks(blocked_id);

alter table public.community_user_blocks enable row level security;

grant select, insert, delete on table public.community_user_blocks to authenticated;

create policy "users read own community blocks"
  on public.community_user_blocks for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

create policy "users create own community blocks"
  on public.community_user_blocks for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id and blocker_id <> blocked_id);

create policy "users delete own community blocks"
  on public.community_user_blocks for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

create table if not exists public.community_user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_post_id uuid references public.community_posts(id) on delete set null,
  evidence_comment_id uuid references public.community_comments(id) on delete set null,
  reason text not null default 'community_user_report',
  status text not null default 'pending'
    check (status in ('pending', 'dismissed', 'sanctioned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  constraint community_user_reports_not_self check (reporter_id <> target_user_id),
  constraint community_user_reports_reason_length check (char_length(reason) between 1 and 1000)
);

create unique index if not exists idx_community_user_reports_one_pending
  on public.community_user_reports(reporter_id, target_user_id)
  where status = 'pending';
create index if not exists idx_community_user_reports_pending
  on public.community_user_reports(created_at)
  where status = 'pending';
create index if not exists idx_community_user_reports_target
  on public.community_user_reports(target_user_id, created_at desc);

alter table public.community_user_reports enable row level security;

grant select, insert on table public.community_user_reports to authenticated;

create policy "users read own community user reports"
  on public.community_user_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_id);

create policy "users create own community user reports"
  on public.community_user_reports for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and reporter_id <> target_user_id
    and status = 'pending'
    and resolved_at is null
    and resolved_by is null
  );

create table if not exists public.community_user_sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id) on delete set null,
  constraint community_user_sanctions_reason_length check (char_length(reason) between 1 and 1000)
);

create unique index if not exists idx_community_user_sanctions_one_active
  on public.community_user_sanctions(user_id)
  where lifted_at is null;
create index if not exists idx_community_user_sanctions_recent
  on public.community_user_sanctions(banned_at desc);

alter table public.community_user_sanctions enable row level security;

-- Sanctions are intentionally service-role only. Admin authorization is enforced
-- in server actions before the service-role client is created.
revoke all on table public.community_user_sanctions from anon, authenticated;
grant all on table public.community_user_sanctions to service_role;

create schema if not exists private;

create or replace function private.current_user_is_community_sanctioned()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.community_user_sanctions sanctions
      where sanctions.user_id = (select auth.uid())
        and sanctions.lifted_at is null
    );
$$;

revoke all on function private.current_user_is_community_sanctioned() from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_is_community_sanctioned() to authenticated;

-- Enforce sanctions at the database boundary too. The application normally writes
-- through server actions, but authenticated users must not be able to bypass a ban
-- by calling the Data API directly.
drop policy if exists "authenticated insert community posts" on public.community_posts;
create policy "authenticated insert community posts"
  on public.community_posts for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "authors update community posts" on public.community_posts;
create policy "authors update community posts"
  on public.community_posts for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  )
  with check (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "authenticated insert community comments" on public.community_comments;
create policy "authenticated insert community comments"
  on public.community_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "authors update community comments" on public.community_comments;
create policy "authors update community comments"
  on public.community_comments for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  )
  with check (
    (select auth.uid()) = author_id
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "users create own community user reports" on public.community_user_reports;
create policy "users create own community user reports"
  on public.community_user_reports for insert
  to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and reporter_id <> target_user_id
    and status = 'pending'
    and resolved_at is null
    and resolved_by is null
    and not (select private.current_user_is_community_sanctioned())
  );
