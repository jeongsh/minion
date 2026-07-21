-- 선수 목록에는 LCK 1군 선수만 노출한다.
--
-- 케스파컵에는 2군도 함께 출전하고, 2군 로스터가 별도로 임포트되기도 해서
-- players 테이블에는 1군/2군이 섞여 있다. 노출 기준을 두 가지로 정의한다.
--   1) LCK 리그 경기 출전 기록이 있는 선수 (실제 1군 출전)
--   2) LCK 1군 로스터로 등록된 선수 (imported_scope = 'lck', 아직 미출전이어도 노출)
--
-- 출전 기록에서 파생시키므로 2군 선수가 LCK 경기에 나가면 백필 없이 자동으로 노출된다.
create or replace view public.roster_players
with (security_invoker = on)
as
select p.*
from public.players p
where p.imported_scope = 'lck'
   or exists (
     select 1
     from public.set_player_stats sps
     join public.sets s on s.id = sps.set_id
     join public.matches m on m.id = s.match_id
     join public.tournaments t on t.id = m.tournament_id
     where sps.player_id = p.id
       and t.league = 'LCK'
   );

grant select on public.roster_players to anon, authenticated, service_role;
