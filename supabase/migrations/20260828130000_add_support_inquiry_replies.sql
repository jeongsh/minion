-- 고객센터 문의에 사이트 내 답변과 비회원 식별자를 추가한다.
-- reply: 이용자에게 노출되는 답변. admin_note는 계속 운영진 전용 메모로 남는다.
-- guest_key: 커뮤니티 비회원 식별자와 같은 쿠키 기반 값을 재사용해, 비회원도 로그인 없이
-- 자기 문의 내역을 볼 수 있게 한다(lib/community/guest-identity.ts와 동일한 해시).

alter table public.support_inquiries
  add column if not exists guest_key text,
  add column if not exists reply text;

create index if not exists idx_support_inquiries_user
  on public.support_inquiries(user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_support_inquiries_guest_key
  on public.support_inquiries(guest_key, created_at desc)
  where guest_key is not null;
