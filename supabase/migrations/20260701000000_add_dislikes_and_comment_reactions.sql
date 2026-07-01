-- 게시판 싫어요(디스) + 댓글 명예/싫어요 리액션 추가
-- 적용은 사용자가 수동으로 수행한다(이 트랙은 원격 DB에 자동 적용하지 않음).
-- 규칙: 한 사용자는 대상(글/댓글)마다 명예·싫어요 중 하나만(상호 배타). 앱 레벨에서 전환 처리.

-- 카운트 컬럼: 글/댓글 싫어요 수(like_count 는 명예 수로 이미 사용 중).
alter table public.community_posts
  add column if not exists dislike_count integer not null default 0;

alter table public.community_comments
  add column if not exists dislike_count integer not null default 0;

-- 글 싫어요: 한 사용자가 한 글에 1회만.
create table if not exists public.post_dislikes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- 댓글 명예: 한 사용자가 한 댓글에 1회만.
create table if not exists public.comment_honors (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

-- 댓글 싫어요: 한 사용자가 한 댓글에 1회만.
create table if not exists public.comment_dislikes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

-- 인덱스
create index if not exists idx_post_dislikes_post_id on public.post_dislikes(post_id);
create index if not exists idx_post_dislikes_user_id on public.post_dislikes(user_id);
create index if not exists idx_comment_honors_comment_id on public.comment_honors(comment_id);
create index if not exists idx_comment_honors_user_id on public.comment_honors(user_id);
create index if not exists idx_comment_dislikes_comment_id on public.comment_dislikes(comment_id);
create index if not exists idx_comment_dislikes_user_id on public.comment_dislikes(user_id);

-- RLS
alter table public.post_dislikes enable row level security;
alter table public.comment_honors enable row level security;
alter table public.comment_dislikes enable row level security;

-- grant (집계 공개 read, authenticated insert/delete)
grant select on public.post_dislikes, public.comment_honors, public.comment_dislikes to anon, authenticated;
grant insert on public.post_dislikes, public.comment_honors, public.comment_dislikes to authenticated;
grant delete on public.post_dislikes, public.comment_honors, public.comment_dislikes to authenticated;

-- 정책: 공개 read(집계용), 본인 것만 insert/delete.
create policy "public read post dislikes" on public.post_dislikes
  for select using (true);
create policy "authenticated insert post dislikes" on public.post_dislikes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "authors delete post dislikes" on public.post_dislikes
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "public read comment honors" on public.comment_honors
  for select using (true);
create policy "authenticated insert comment honors" on public.comment_honors
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "authors delete comment honors" on public.comment_honors
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "public read comment dislikes" on public.comment_dislikes
  for select using (true);
create policy "authenticated insert comment dislikes" on public.comment_dislikes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "authors delete comment dislikes" on public.comment_dislikes
  for delete to authenticated using ((select auth.uid()) = user_id);
