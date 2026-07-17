-- 블라인드 주체 구분: ai(정화봇 자동 차단) / report(신고 누적) / admin(운영자 수동).
-- UI 문구("정화봇이 차단한 게시글입니다" vs "신고 누적으로 블라인드된 게시글입니다")를 가른다.

alter table public.community_posts
  add column if not exists blinded_source text;

alter table public.community_comments
  add column if not exists blinded_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'community_posts_blinded_source_chk') then
    alter table public.community_posts
      add constraint community_posts_blinded_source_chk
      check (blinded_source is null or blinded_source in ('ai', 'report', 'admin'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'community_comments_blinded_source_chk') then
    alter table public.community_comments
      add constraint community_comments_blinded_source_chk
      check (blinded_source is null or blinded_source in ('ai', 'report', 'admin'));
  end if;
end $$;

-- 백필: 이미 블라인드된 행은 AI 신고 존재 여부로 주체를 추정한다.
update public.community_posts p
  set blinded_source = case
    when exists (select 1 from public.post_reports r where r.post_id = p.id and r.source = 'ai') then 'ai'
    else 'report'
  end
  where p.blinded_at is not null and p.blinded_source is null;

update public.community_comments c
  set blinded_source = case
    when exists (select 1 from public.post_reports r where r.comment_id = c.id and r.source = 'ai') then 'ai'
    else 'report'
  end
  where c.blinded_at is not null and c.blinded_source is null;
