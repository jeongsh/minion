-- 웹 익명 쿠키/앱 설치 ID에서 파생한 guest_key 로 비회원 반응과 신고를 식별한다.
-- 원본 쿠키·설치 ID·IP는 저장하지 않는다. 회원 ID와 guest_key 중 정확히 하나만 사용한다.

alter table public.post_honors
  alter column user_id drop not null,
  add column if not exists guest_key text;
alter table public.post_dislikes
  alter column user_id drop not null,
  add column if not exists guest_key text;
alter table public.comment_honors
  alter column user_id drop not null,
  add column if not exists guest_key text;
alter table public.comment_dislikes
  alter column user_id drop not null,
  add column if not exists guest_key text;

alter table public.post_honors
  add constraint post_honors_actor_chk check (num_nonnulls(user_id, guest_key) = 1);
alter table public.post_dislikes
  add constraint post_dislikes_actor_chk check (num_nonnulls(user_id, guest_key) = 1);
alter table public.comment_honors
  add constraint comment_honors_actor_chk check (num_nonnulls(user_id, guest_key) = 1);
alter table public.comment_dislikes
  add constraint comment_dislikes_actor_chk check (num_nonnulls(user_id, guest_key) = 1);

create unique index idx_post_honors_unique_guest
  on public.post_honors(post_id, guest_key) where guest_key is not null;
create unique index idx_post_dislikes_unique_guest
  on public.post_dislikes(post_id, guest_key) where guest_key is not null;
create unique index idx_comment_honors_unique_guest
  on public.comment_honors(comment_id, guest_key) where guest_key is not null;
create unique index idx_comment_dislikes_unique_guest
  on public.comment_dislikes(comment_id, guest_key) where guest_key is not null;

alter table public.post_reports
  add column if not exists guest_key text;

alter table public.post_reports
  drop constraint if exists post_reports_reporter_chk;
alter table public.post_reports
  add constraint post_reports_reporter_chk check (
    (source = 'ai' and reporter_id is null and guest_key is null)
    or
    (source = 'user' and num_nonnulls(reporter_id, guest_key) = 1)
  );

create unique index idx_post_reports_unique_guest_post
  on public.post_reports(guest_key, post_id)
  where guest_key is not null and post_id is not null and source = 'user';
create unique index idx_post_reports_unique_guest_comment
  on public.post_reports(guest_key, comment_id)
  where guest_key is not null and comment_id is not null and source = 'user';

-- 집계는 community_posts/community_comments 컬럼으로 제공한다. 원본 반응/신고 행은 서버 전용이다.
drop policy if exists "public read post honors" on public.post_honors;
drop policy if exists "public read post dislikes" on public.post_dislikes;
drop policy if exists "public read comment honors" on public.comment_honors;
drop policy if exists "public read comment dislikes" on public.comment_dislikes;
drop policy if exists "public read post reports" on public.post_reports;

revoke all on table public.post_honors from anon, authenticated;
revoke all on table public.post_dislikes from anon, authenticated;
revoke all on table public.comment_honors from anon, authenticated;
revoke all on table public.comment_dislikes from anon, authenticated;
revoke all on table public.post_reports from anon, authenticated;

grant select, insert, delete on table public.post_honors to service_role;
grant select, insert, delete on table public.post_dislikes to service_role;
grant select, insert, delete on table public.comment_honors to service_role;
grant select, insert, delete on table public.comment_dislikes to service_role;
grant select, insert, update, delete on table public.post_reports to service_role;

notify pgrst, 'reload schema';
