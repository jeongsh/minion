-- timeline_frame_wait_attempts는 프레임 대기 시도를 별도로 세기 위해 추가했었지만,
-- runTimelineEnrichment 쿼리를 leaguepedia_sync_status='succeeded'인 세트만 대상으로
-- 제한하는 방식으로 대체했다 - 세트 정보(밴픽·선수 스탯)가 다 채워진 뒤에만 타임라인
-- 동기화를 시도하므로 timeline_sync_attempts 자체가 순수하게 프레임 대기 횟수가 된다.
alter table public.set_result_snapshots
  drop column if exists timeline_frame_wait_attempts;
