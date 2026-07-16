-- ENC(Esports Nations Cup, 2026-11-21~29) 우승/준우승을 team_awards에 기록할 수 있도록
-- award_type 허용 목록에 enc_champion/enc_runner_up을 추가한다. 지금까지는 이 값이
-- 목록에 없어서 lib/sync/leaguepedia-awards.ts의 LEAGUE_TO_AWARD에 ENC를 매핑해도
-- insert가 CHECK 위반으로 실패했다.

alter table public.team_awards
  drop constraint if exists team_awards_award_type_check;
alter table public.team_awards
  add constraint team_awards_award_type_check check (award_type in (
    'lck_champion', 'lck_runner_up',
    'worlds_champion', 'worlds_runner_up',
    'msi_champion', 'msi_runner_up',
    'first_stand_champion', 'first_stand_runner_up',
    'ewc_champion', 'ewc_runner_up',
    'enc_champion', 'enc_runner_up',
    'lck_finals_mvp', 'worlds_mvp', 'msi_mvp',
    'all_lck_first', 'all_lck_second',
    'rookie_of_year'
  ));

notify pgrst, 'reload schema';
