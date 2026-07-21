-- LCK 각 팀의 2군(챌린저스) 로스터를 별도 스코프로 관리하기 위해 imported_scope에 값을 추가한다.
-- 2군 선수는 team_id는 1군과 동일한 팀을 가리키되(같은 조직), imported_scope='challengers'로 표시해
-- 공개 화면(선수 목록/팀 로스터)에서는 kespa_cup과 마찬가지로 제외하고 어드민에서만 토글로 노출한다.
alter table public.players
  drop constraint if exists players_imported_scope_check;

alter table public.players
  add constraint players_imported_scope_check
    check (imported_scope in ('lck', 'international_event', 'manual', 'kespa_cup', 'challengers'));
