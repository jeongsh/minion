-- 부분 유니크 인덱스(where dedupe_key is not null)는 upsert의
-- "on conflict (dedupe_key)" 절과 호환되지 않는다(PostgREST/Postgres가
-- 일반 컬럼 지정만으로는 부분 인덱스를 arbiter로 못 찾아서 42P10 에러).
-- 우리 코드가 넣는 모든 행은 항상 dedupe_key를 채우므로 부분 인덱스일
-- 필요가 애초에 없었다 — 일반 유니크 제약으로 바꾼다.
drop index if exists public.idx_live_match_events_dedupe_key;

alter table public.live_match_events
  add constraint live_match_events_dedupe_key_key unique (dedupe_key);
