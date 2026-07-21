-- 케스파컵은 2군 선수도 함께 출전하므로, 케스파컵에서만 등장한 선수는 별도 스코프로 분리해 선수 목록에서 제외한다.
alter table public.players
  drop constraint if exists players_imported_scope_check;

alter table public.players
  add constraint players_imported_scope_check
    check (imported_scope in ('lck', 'international_event', 'manual', 'kespa_cup'));

-- 기존 데이터 보정: 케스파컵 경기에만 출전 기록이 있는 자동 생성 선수를 kespa_cup 스코프로 옮긴다.
with appearances as (
  select sps.player_id, m.tournament_id
  from public.set_player_stats sps
  join public.sets s on s.id = sps.set_id
  join public.matches m on m.id = s.match_id
  group by 1, 2
),
kespa_only as (
  select a.player_id
  from appearances a
  join public.tournaments t on t.id = a.tournament_id
  group by a.player_id
  having bool_and(t.league = 'KeSPA Cup')
)
update public.players p
set imported_scope = 'kespa_cup'
from kespa_only k
where p.id = k.player_id
  and p.imported_scope = 'lck';
