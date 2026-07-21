-- 팔로우를 쿠키(voter_key) 기반에서 로그인 계정 기반으로 전환한다.
-- 헤더 업로드 자격("팔로우 N일 이상")을 계정에 귀속시키려면 계정 단위 팔로우가 필요하다.
--
-- 기존 익명 행은 지우지 않고 남긴다(팔로워 수 유지). voter_key만 있는 행은 레거시로 취급하고,
-- 신규 팔로우는 user_id를 채운다. 둘 다 채워질 수도 있다(로그인 상태에서 팔로우).

alter table team_fans
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- voter_key는 이제 선택값이다(계정 기반 팔로우에는 쿠키가 없을 수 있다).
alter table team_fans
  alter column voter_key drop not null;

-- 한 계정이 같은 팀을 두 번 팔로우할 수 없다.
create unique index if not exists team_fans_team_id_user_id_key
  on team_fans (team_id, user_id)
  where user_id is not null;

-- 팔로우 기간 조회(자격 판정)에서 쓰는 경로.
create index if not exists team_fans_user_id_created_at_idx
  on team_fans (user_id, created_at)
  where user_id is not null;

-- 기존 (team_id, voter_key) 유니크는 voter_key가 null인 행을 막지 않으므로 그대로 둔다.
-- 다만 null 다중 행을 허용하려면 부분 인덱스로 바꾸는 편이 명확하다.
alter table team_fans
  drop constraint if exists team_fans_team_id_voter_key_key;

create unique index if not exists team_fans_team_id_voter_key_key
  on team_fans (team_id, voter_key)
  where voter_key is not null;
