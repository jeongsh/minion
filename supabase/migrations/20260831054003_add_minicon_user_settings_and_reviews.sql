alter table public.minicon_packs
  add column review_note text,
  add column reviewed_by uuid references auth.users(id) on delete set null,
  add column reviewed_at timestamptz,
  add column submitted_at timestamptz,
  add column rights_confirmed_at timestamptz,
  add constraint minicon_packs_review_note_check
    check (review_note is null or char_length(review_note) <= 500),
  add constraint minicon_packs_submission_rights_check
    check (
      status not in ('pending_review', 'published')
      or is_official
      or rights_confirmed_at is not null
    );

create index minicon_packs_review_queue_idx
  on public.minicon_packs(created_at)
  where status = 'pending_review';

create index minicon_packs_reviewed_by_idx
  on public.minicon_packs(reviewed_by)
  where reviewed_by is not null;

create policy "creators read own minicon packs"
  on public.minicon_packs for select
  to authenticated
  using ((select auth.uid()) = creator_id);

create policy "creators read own minicon items"
  on public.minicon_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.minicon_packs pack
      where pack.id = minicon_items.pack_id
        and pack.creator_id = (select auth.uid())
    )
  );

-- 검토 메모와 검토자 정보는 service_role만 읽는다. 일반 클라이언트에는
-- 공개 카탈로그와 본인 신청 상태를 표시하는 데 필요한 열만 노출한다.
revoke select on table public.minicon_packs from anon, authenticated;
grant select (
  id,
  slug,
  name,
  description,
  status,
  cover_url,
  is_official,
  sort_order,
  created_at,
  updated_at,
  published_at,
  submitted_at
) on table public.minicon_packs to anon, authenticated;

create table public.user_minicon_packs (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.minicon_packs(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id),
  constraint user_minicon_packs_sort_order_check
    check (sort_order between 0 and 199)
);

create index user_minicon_packs_pack_id_idx
  on public.user_minicon_packs(pack_id);

alter table public.user_minicon_packs enable row level security;

revoke all on table public.user_minicon_packs from anon, authenticated;
grant select, insert, update, delete on table public.user_minicon_packs to authenticated;
grant all on table public.user_minicon_packs to service_role;

create policy "users read own minicon packs"
  on public.user_minicon_packs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users add own published minicon packs"
  on public.user_minicon_packs for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.minicon_packs pack
      where pack.id = user_minicon_packs.pack_id
        and pack.status = 'published'
    )
  );

create policy "users reorder own published minicon packs"
  on public.user_minicon_packs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.minicon_packs pack
      where pack.id = user_minicon_packs.pack_id
        and pack.status = 'published'
    )
  );

create policy "users remove own minicon packs"
  on public.user_minicon_packs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

comment on column public.minicon_packs.review_note is
  '관리자 심사 메모. 일반 Data API 역할에는 열 권한을 부여하지 않는다.';
comment on column public.minicon_packs.rights_confirmed_at is
  '신청자가 저작물 이용 권리를 확인한 시각';
comment on table public.user_minicon_packs is
  '사용자별 댓글 선택기에 표시할 공개 미니콘 패키지와 순서';
