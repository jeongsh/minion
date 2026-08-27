-- 신규 회원 온보딩 완료 여부를 프로필에 보관한다.
-- 기능이 배포되기 전에 가입한 기존 회원은 온보딩을 다시 강제하지 않는다.
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = created_at
where onboarding_completed_at is null
  and created_at < timestamptz '2026-08-26 14:30:33+09';

comment on column public.profiles.onboarding_completed_at is
  '프로필과 최애팀으로 구성된 최초 온보딩을 완료하거나 건너뛴 시각';

notify pgrst, 'reload schema';
