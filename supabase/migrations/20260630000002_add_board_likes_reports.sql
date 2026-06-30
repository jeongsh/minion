-- 게시판 명예(좋아요)·리폿(신고) 테이블 추가
-- 적용은 사용자가 수동으로 수행한다(이 트랙은 원격 DB에 적용하지 않음).

-- community_posts 에 리폿 누적 카운트 컬럼 추가(like_count 는 명예 수로 사용).
alter table public.community_posts
  add column if not exists report_count integer not null default 0;

-- 명예(글 좋아요): 한 사용자가 한 글에 1회만.
create table if not exists public.post_honors (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- 리폿(신고): 글/댓글 둘 다 신고 가능(둘 중 하나만 채워짐).
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  -- 글 또는 댓글 중 하나는 반드시 대상으로 지정
  constraint post_reports_target_chk check (post_id is not null or comment_id is not null)
);

-- 인덱스
create index if not exists idx_post_honors_post_id on public.post_honors(post_id);
create index if not exists idx_post_honors_user_id on public.post_honors(user_id);
create index if not exists idx_post_reports_post_id on public.post_reports(post_id);
create index if not exists idx_post_reports_comment_id on public.post_reports(comment_id);
create index if not exists idx_post_reports_reporter_id on public.post_reports(reporter_id);

-- 중복 리폿 방지(같은 신고자가 같은 글/댓글을 중복 신고 못 하도록).
create unique index if not exists idx_post_reports_unique_post
  on public.post_reports(reporter_id, post_id) where post_id is not null;
create unique index if not exists idx_post_reports_unique_comment
  on public.post_reports(reporter_id, comment_id) where comment_id is not null;

-- RLS
alter table public.post_honors enable row level security;
alter table public.post_reports enable row level security;

-- grant (집계 공개 read, authenticated insert/delete)
grant select on public.post_honors, public.post_reports to anon, authenticated;
grant insert on public.post_honors, public.post_reports to authenticated;
grant delete on public.post_honors to authenticated;

-- 명예: 공개 read(집계용), 본인 명예만 insert/delete.
create policy "public read post honors" on public.post_honors
  for select using (true);
create policy "authenticated insert post honors" on public.post_honors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "authors delete post honors" on public.post_honors
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 리폿: 공개 read(집계용), 본인 신고만 insert.
create policy "public read post reports" on public.post_reports
  for select using (true);
create policy "authenticated insert post reports" on public.post_reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);
