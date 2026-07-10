-- 골드 프레임 대기 재시도 횟수를 별도 컬럼으로 분리한다.
-- 기존에는 timeline_sync_attempts(경기 종료 직후 선수 스탯/타임라인 페이지 준비를
-- 기다리는 동안의 시도 횟수까지 포함)를 MAX_FRAME_WAIT_ATTEMPTS 비교에 그대로
-- 재사용해서, 준비 대기로 이미 여러 번 재시도한 세트는 골드 프레임이 실제로
-- 늦게 채워지기도 전에 예산을 소진해 framesInserted=0인 채로 영구히
-- succeeded 처리되는 문제가 있었다.
alter table public.set_result_snapshots
  add column if not exists timeline_frame_wait_attempts integer not null default 0;
