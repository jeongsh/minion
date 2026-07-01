-- 문서(match-schedule-management-rework.md) 11절: 매치/세트 결과 정합성을 DB 레벨에서도 보장한다.
-- 같은 행 안의 컬럼끼리 비교하는 제약만 추가한다 — 세트의 블루/레드 팀이 매치 참가팀
-- 안에 있는지 같은 다른 테이블을 참조해야 하는 검증은 서비스 레이어(app/admin/sets/actions.ts
-- setPayload())에서 이미 처리하고 있어 DB CHECK로 다시 넣지 않는다.

alter table public.matches
  drop constraint if exists matches_team_a_score_nonnegative;
alter table public.matches
  add constraint matches_team_a_score_nonnegative check (team_a_score is null or team_a_score >= 0);

alter table public.matches
  drop constraint if exists matches_team_b_score_nonnegative;
alter table public.matches
  add constraint matches_team_b_score_nonnegative check (team_b_score is null or team_b_score >= 0);

alter table public.matches
  drop constraint if exists matches_team_a_b_distinct;
alter table public.matches
  add constraint matches_team_a_b_distinct
  check (team_a_id is null or team_b_id is null or team_a_id <> team_b_id);

alter table public.matches
  drop constraint if exists matches_winner_in_participants;
alter table public.matches
  add constraint matches_winner_in_participants
  check (winner_team_id is null or winner_team_id = team_a_id or winner_team_id = team_b_id);

alter table public.sets
  drop constraint if exists sets_blue_red_distinct;
alter table public.sets
  add constraint sets_blue_red_distinct
  check (blue_team_id is null or red_team_id is null or blue_team_id <> red_team_id);

-- 아래 두 제약은 기존 데이터에 위반 건이 있어(2026-07-01 진단 기준: 세트 승자가
-- 블루/레드 밖 27건 — Leaguepedia 팀명 해석 별개 버그, 세트 실종으로 결과 상태인데
-- 승자 없음 16건 — 게임 자체가 sets 테이블에 통째로 없는 별개 데이터 갭) NOT VALID로
-- 추가한다. 새로 쓰는/바뀌는 행부터는 즉시 강제되고, 기존 위반 행은 그대로 남는다.
-- 위 두 이슈가 정리된 뒤 별도로 `alter table ... validate constraint ...`를 실행한다.
alter table public.sets
  drop constraint if exists sets_winner_in_sides;
alter table public.sets
  add constraint sets_winner_in_sides
  check (winner_team_id is null or winner_team_id = blue_team_id or winner_team_id = red_team_id)
  not valid;

alter table public.sets
  drop constraint if exists sets_result_status_requires_winner;
alter table public.sets
  add constraint sets_result_status_requires_winner
  check (status not in ('finished', 'data_synced') or winner_team_id is not null)
  not valid;

notify pgrst, 'reload schema';
