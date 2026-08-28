-- 답변을 사이트 내에서 직접 하기로 하면서 연락 이메일은 더 이상 필수가 아니다.
alter table public.support_inquiries alter column contact_email drop not null;
