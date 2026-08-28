-- 로그인 작성자는 비공개 글을 볼 때 이미 비밀번호 없이 자동 통과한다(user_id 일치).
-- 그러니 쓸 때도 비밀번호를 강제할 필요가 없다 — 계정에 묶인 비공개는 비밀번호 없이도
-- "작성자 본인만" 접근을 보장할 수 있다. 비회원은 계정이 없어 여전히 비밀번호가 유일한
-- 잠금 수단이라 필수로 남긴다.
alter table public.support_inquiries
  drop constraint if exists support_inquiries_private_password_chk;

alter table public.support_inquiries
  add constraint support_inquiries_private_password_chk
  check (is_private = false or password_hash is not null or user_id is not null);
