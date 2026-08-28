-- 고객센터 문의. 로그인 사용자는 계정에 연결하고, 비로그인 사용자는 연락 이메일만 받는다.
-- 문의 열람/답변은 운영진 전용이라 쓰기·읽기 모두 서버 액션(service role)에서만 하고 RLS는 전부 닫는다.

create table if not exists public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  contact_email text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  admin_note text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references auth.users(id) on delete set null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'support_inquiries_status_chk') then
    alter table public.support_inquiries
      add constraint support_inquiries_status_chk
      check (status in ('open', 'answered', 'closed'));
  end if;
end $$;

-- 운영 큐: 미처리 문의를 오래된 순으로 본다.
create index if not exists idx_support_inquiries_status
  on public.support_inquiries(status, created_at desc);

-- 스팸 방지 판정(같은 이메일의 최근 제출 수 확인)용.
create index if not exists idx_support_inquiries_contact_email
  on public.support_inquiries(contact_email, created_at desc);

alter table public.support_inquiries enable row level security;
-- 공개 정책 없음: 제출(insert)과 열람(select) 모두 service role 경유로만 처리한다.
