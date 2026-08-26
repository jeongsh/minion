-- 선수 빌드 이벤트는 같은 밀리초에 여러 선수가 구매하거나, 한 선수가 여러 아이템을
-- 구매할 수 있다. 기존 인덱스는 player_id와 raw_event_json을 구분하지 않아 정상 이벤트를
-- 중복으로 오인했다. 원본 Riot 이벤트와 로컬 매핑을 모두 식별자에 포함한다.
-- 과거에 같은 원본 오브젝트 이벤트가 매핑 전/후로 각각 저장된 경우도 삭제하지 않고 보존한다.
drop index if exists public.idx_timeline_events_unique;

create unique index idx_timeline_events_unique
  on public.timeline_events (
    set_id,
    timestamp_ms,
    event_type,
    md5(raw_event_json::text),
    coalesce(team_id::text, ''),
    coalesce(player_id::text, ''),
    coalesce(killer_player_id::text, ''),
    coalesce(victim_player_id::text, ''),
    coalesce(monster_type, ''),
    coalesce(building_type, ''),
    coalesce(lane_type, '')
  );
