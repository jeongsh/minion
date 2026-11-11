-- 승부예측 정산 결과를 기존 알림함(community_notifications)에 함께 싣는다.
-- 정산은 matches 트리거가 DB 안에서 끝내므로 앱은 정산 시점을 알 수 없다. 1분 크론
-- (/api/cron/match-start-notifications)이 아직 알리지 않은 정산 건을 result_notified_at으로
-- 원자적으로 집어 알림함 행과 앱 푸시를 만든다(matches.start_notification_sent_at과 같은 방식).
set lock_timeout = '5s';

alter table public.community_notifications
  drop constraint community_notifications_kind_check;

alter table public.community_notifications
  add constraint community_notifications_kind_check
  check (kind in ('post_comment', 'comment_reply', 'admin_report', 'admin_block', 'prediction_result'));

alter table public.prediction_bets
  add column result_notified_at timestamptz;

-- 이 변경 이전에 정산된 예측은 뒤늦게 알리지 않는다.
update public.prediction_bets
set result_notified_at = settled_at
where settled_at is not null;

-- 크론은 매분 "정산됐고 아직 알리지 않은" 행만 찾는다. 대부분의 행은 이 조건 밖이라 색인이 작게 유지된다.
create index prediction_bets_result_unnotified_idx
  on public.prediction_bets (settled_at)
  where result_notified_at is null and settled_at is not null;

notify pgrst, 'reload schema';
