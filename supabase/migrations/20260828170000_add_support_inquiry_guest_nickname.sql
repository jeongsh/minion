-- 비회원 문의는 자동 생성 닉네임 대신 직접 정한 닉네임을 쓴다. 화면에는 항상
-- "GUEST_" 접두사를 붙여 표시해 회원과 구분한다(접두사 자체는 저장하지 않는다).
alter table public.support_inquiries
  add column if not exists guest_nickname text;
