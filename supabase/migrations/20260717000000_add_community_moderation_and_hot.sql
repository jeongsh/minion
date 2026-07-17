-- 커뮤니티 모더레이션 + 인기글(HOT) 기반 작업.
-- 1) 글/댓글 소프트 삭제·블라인드 상태 컬럼
-- 2) 신고 처리 상태(pending → confirmed | dismissed)
-- 3) 인기글 등재 시각(hot_at) 스냅샷 + 공지 고정(is_notice)
-- 4) 스코프별 운영 설정 테이블(community_settings): 인기글 컷 / 자동 블라인드 임계값

-- 글: 소프트 삭제/블라인드/인기글 등재 시각/공지 고정.
alter table public.community_posts
  add column if not exists deleted_at timestamptz,
  add column if not exists blinded_at timestamptz,
  add column if not exists hot_at timestamptz,
  add column if not exists is_notice boolean not null default false;

-- 댓글: 소프트 삭제/블라인드.
alter table public.community_comments
  add column if not exists deleted_at timestamptz,
  add column if not exists blinded_at timestamptz;

-- 신고 처리 상태. pending=접수, confirmed=제재 확정(LP 차감), dismissed=기각(블라인드 해제).
alter table public.post_reports
  add column if not exists status text not null default 'pending',
  add column if not exists resolved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_reports_status_chk') then
    alter table public.post_reports
      add constraint post_reports_status_chk check (status in ('pending', 'confirmed', 'dismissed'));
  end if;
end $$;

-- 커뮤니티 운영 설정(스코프별). 쓰기는 service-role 전용(정책 없음 = anon/authenticated 쓰기 불가).
create table if not exists public.community_settings (
  scope text primary key check (scope in ('hub', 'team')),
  hot_cut integer not null default 5,
  blind_report_count integer not null default 3,
  updated_at timestamptz not null default now()
);

insert into public.community_settings (scope)
values ('hub'), ('team')
on conflict (scope) do nothing;

alter table public.community_settings enable row level security;
grant select on public.community_settings to anon, authenticated;
drop policy if exists "public read community settings" on public.community_settings;
create policy "public read community settings" on public.community_settings
  for select using (true);

-- 인덱스: 인기글 조회(hot_at 역순), 미처리 신고 큐.
create index if not exists idx_community_posts_hot_at
  on public.community_posts(hot_at desc) where hot_at is not null;
create index if not exists idx_post_reports_pending
  on public.post_reports(created_at) where status = 'pending';

-- 백필: 이미 명예-싫어요가 기본 컷(5) 이상인 글은 인기글로 승격(등재 시각은 작성 시각으로 근사).
update public.community_posts
  set hot_at = created_at
  where hot_at is null
    and (like_count - coalesce(dislike_count, 0)) >= 5
    and deleted_at is null;
