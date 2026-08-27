create table public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_guest_key text,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text not null,
  kind text not null check (kind in ('post_comment', 'comment_reply')),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  title text not null,
  description text not null,
  href text not null,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (num_nonnulls(recipient_user_id, recipient_guest_key) = 1)
);

create index idx_community_notifications_user_created
  on public.community_notifications(recipient_user_id, created_at desc)
  where recipient_user_id is not null;

create index idx_community_notifications_guest_created
  on public.community_notifications(recipient_guest_key, created_at desc)
  where recipient_guest_key is not null;

alter table public.community_notifications enable row level security;

-- 알림 수신자 범위는 웹 쿠키/모바일 설치 ID를 서버에서 검증한 뒤 서비스 역할로만
-- 접근한다. 원본 guest key를 클라이언트에 노출하거나 Data API로 직접 조회하지 않는다.
revoke all on table public.community_notifications from anon, authenticated;

-- Ensure PostgREST sees the newly created table immediately.
notify pgrst, 'reload schema';
