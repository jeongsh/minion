-- 비공개 문의 비밀번호 확인에 브루트포스 방어가 전혀 없었다(비밀번호 최소 4자,
-- 시도 횟수 제한 없음). 별도 시도 기록 테이블 없이 문의 행에 카운터만 두는
-- 가벼운 잠금으로 막는다. 틀린 횟수가 쌓이면 일정 시간 동안 해당 글의 잠금 해제
-- 시도 자체를 막는다(관리자 화면은 service role로 이 문의를 그대로 볼 수 있어 영향 없음).
alter table public.support_inquiries
  add column if not exists unlock_attempts integer not null default 0,
  add column if not exists unlock_locked_until timestamptz;
