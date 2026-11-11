-- 세트별 첫 킬, 첫 타워, 첫 전령, 첫 바론을 가져간 팀.
-- 매치 프리뷰가 최근 표본 세트의 선취 비율을 낼 때 쓴다. timeline_events에서 바로 계산하는
-- 뷰라서 별도 적재나 백필이 없고, 타임라인이 다시 동기화돼도 어긋나지 않는다.
-- set_id 조건은 group by 키라 뷰 안쪽 idx_timeline_events_set_id까지 내려간다.
-- timeline_events.team_id는 동기화 단계에서 이미 "가져간 팀"으로 맞춰져 있다(타워는 파괴한 팀).
create view public.set_first_objectives
with (security_invoker = true) as
select
  set_id,
  (array_agg(team_id order by timestamp_ms, id)
    filter (where event_type = 'CHAMPION_KILL'))[1] as first_kill_team_id,
  (array_agg(team_id order by timestamp_ms, id)
    filter (where event_type = 'BUILDING_KILL' and building_type = 'TOWER_BUILDING'))[1] as first_tower_team_id,
  (array_agg(team_id order by timestamp_ms, id)
    filter (where event_type = 'ELITE_MONSTER_KILL' and monster_type = 'RIFTHERALD'))[1] as first_herald_team_id,
  (array_agg(team_id order by timestamp_ms, id)
    filter (where event_type = 'ELITE_MONSTER_KILL' and monster_type = 'BARON_NASHOR'))[1] as first_baron_team_id
from public.timeline_events
where team_id is not null
  and event_type in ('CHAMPION_KILL', 'BUILDING_KILL', 'ELITE_MONSTER_KILL')
group by set_id;

-- 서버(service role)만 읽는다. 원본 timeline_events는 공개 읽기지만 이 뷰를 Data API에 열 이유가 없다.
revoke all on public.set_first_objectives from public, anon, authenticated;
grant select on public.set_first_objectives to service_role;

notify pgrst, 'reload schema';
