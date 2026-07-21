-- 헤더(대문)를 "팬 투표로 자동 선정"에서 "팬이 요청 → 운영진이 수동 검토"로 바꾼다.
-- 투표는 공지 글에 붙는 에디터 투표 블록으로 옮기므로, 후보 테이블에는 검토 상태만 둔다.

alter table public.fan_header_candidates
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fan_header_candidates_status_chk') then
    alter table public.fan_header_candidates
      add constraint fan_header_candidates_status_chk
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

-- 운영진 검토 큐: 미처리 요청을 오래된 순으로 본다.
create index if not exists idx_fan_header_candidates_pending
  on public.fan_header_candidates(created_at)
  where status = 'pending' and deleted_at is null;

-- 공개 읽기는 승인된 것만. 검토 대기/반려 요청은 목록에 노출하지 않는다.
drop policy if exists "public read fan header candidates" on public.fan_header_candidates;
create policy "public read fan header candidates" on public.fan_header_candidates
  for select using (deleted_at is null and blinded_at is null and status = 'approved');
