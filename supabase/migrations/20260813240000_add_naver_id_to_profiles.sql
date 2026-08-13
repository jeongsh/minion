-- Supabase의 내장 커스텀 OIDC 연동이 네이버의 비표준 userinfo 응답 구조(email이
-- 최상위가 아니라 response.email 안에 중첩됨)를 못 읽어서, 네이버 로그인을 이 앱이
-- 직접 처리하는 방식으로 전환한다(app/auth/naver, app/auth/naver/callback). 이때
-- 네이버 고유 사용자 ID로 기존 계정을 다시 찾아올 수 있어야 하므로 profiles에
-- naver_id를 추가한다.
alter table public.profiles
  add column if not exists naver_id text unique;
