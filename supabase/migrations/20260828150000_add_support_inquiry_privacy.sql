-- 고객센터 문의를 개인 문의함에서 게시판형으로 바꾼다. 기본은 전체 공개이고,
-- 작성 시 비공개를 선택하면 비밀번호로 잠근다(옛 커뮤니티 게시판의 "비밀글"과 같은 개념).
-- 비밀번호는 scrypt 해시(salt:hash 16진수)만 저장하고 원문은 절대 저장하지 않는다.

alter table public.support_inquiries
  add column if not exists is_private boolean not null default false,
  add column if not exists password_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_inquiries_private_password_chk') then
    alter table public.support_inquiries
      add constraint support_inquiries_private_password_chk
      check (is_private = false or password_hash is not null);
  end if;
end $$;

-- 게시판 목록: 최신순 전체 조회.
create index if not exists idx_support_inquiries_created_at
  on public.support_inquiries(created_at desc);
