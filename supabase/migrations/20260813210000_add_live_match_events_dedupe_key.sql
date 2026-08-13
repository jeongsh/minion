-- 같은 diff 구간을 두 요청이 동시에 계산해서 같은 이벤트를 두 번 저장하는 경합
-- 상태(race condition)를 막기 위한 dedupe 키. 매치 ID + diff 기준 시점(직전
-- duration) + 이벤트 내용 + 배치 내 순서로 결정론적으로 만들어서, 같은 diff를
-- 두 번 계산해도 같은 키가 나오게 한다.
alter table public.live_match_events
  add column if not exists dedupe_key text;

create unique index if not exists idx_live_match_events_dedupe_key
  on public.live_match_events(dedupe_key)
  where dedupe_key is not null;
