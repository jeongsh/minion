alter table public.user_notification_preferences
  add column if not exists team_content_enabled boolean not null default true;

create table if not exists public.team_content_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  kind text not null check (kind in ('team_video', 'team_social')),
  source_id uuid not null,
  title text not null,
  description text not null,
  href text not null,
  image_url text,
  dedupe_key text not null unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_team_content_notifications_recipient_created
  on public.team_content_notifications (recipient_user_id, created_at desc);

create index if not exists idx_team_content_notifications_team_id
  on public.team_content_notifications (team_id);

alter table public.team_content_notifications enable row level security;

-- 수신자 검증과 알림 변경은 웹/앱 API에서 서비스 역할로만 수행한다.
-- Data API 클라이언트가 다른 사용자의 알림을 직접 조회하지 못하게 한다.
revoke all on table public.team_content_notifications from anon, authenticated;

-- 기존 팔로워는 팀별 새 소식 알림을 기본값(켜짐)으로 시작한다. 이후에는
-- 웹/앱 팔로우 처리에서 구독 행을 함께 만들고, 팀 헤더의 종 버튼으로 끌 수 있다.
insert into public.fan_notification_subscriptions (user_id, team_id, match_alerts, news_alerts)
select distinct user_id, team_id, true, true
from public.team_fans
where user_id is not null
on conflict (user_id, team_id) do nothing;

notify pgrst, 'reload schema';
