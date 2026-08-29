alter table public.fan_notification_subscriptions
  add column if not exists live_match_alerts boolean not null default false,
  add column if not exists instagram_alerts boolean not null default true,
  add column if not exists video_alerts boolean not null default true,
  add column if not exists solo_queue_alerts boolean not null default false;

-- 기존 전역 선택을 팀별 초기값으로 옮긴다. 이후 알림 종류는 이 팀별 값을
-- 기준으로 발송하고, user_notification_preferences.in_app_enabled는 전체 알림
-- 마스터로만 사용한다.
update public.fan_notification_subscriptions as subscription
set
  match_alerts = subscription.match_alerts
    and coalesce(preference.match_start_enabled, true),
  live_match_alerts = subscription.match_alerts
    and coalesce(preference.match_events_enabled, false),
  instagram_alerts = subscription.news_alerts
    and coalesce(preference.team_content_enabled, true),
  video_alerts = subscription.news_alerts
    and coalesce(preference.team_content_enabled, true)
from public.user_notification_preferences as preference
where preference.user_id = subscription.user_id;

notify pgrst, 'reload schema';
