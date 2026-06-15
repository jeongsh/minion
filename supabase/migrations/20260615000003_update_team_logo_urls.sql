-- LCK 10개 팀 로고 경로를 /logos/{slug}.svg 규칙으로 통일한다.
update public.teams
set
  logo_url = '/logos/' || slug || '.svg',
  logo_white_url = '/logos/' || slug || '-white.svg';

-- 팀 정체성 이력도 동일 규칙 적용. KRX는 DRX 팀 로고를 사용한다.
update public.team_identity_histories
set logo_url = case
  when slug = 'krx' then '/logos/drx.svg'
  else '/logos/' || slug || '.svg'
end;
