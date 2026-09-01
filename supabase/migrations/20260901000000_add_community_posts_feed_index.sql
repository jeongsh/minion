-- 팬톡/허브 커뮤니티 목록(getBoardPostPage)의 기본 피드 쿼리 최적화.
--   where site_scope = ? [and team_id = ?] and deleted_at is null and is_notice = false
--   order by created_at desc
-- 지금까지 (site_scope, team_id, created_at) 순서 인덱스가 없어 해당 스코프 글 전체를
-- seq scan + sort 하고 count(exact)까지 매 요청 반복했다. 삭제글/공지를 제외한 부분
-- 인덱스로 목록 조회를 인덱스 레인지 스캔으로 바꾼다.
create index if not exists idx_community_posts_feed
  on public.community_posts (site_scope, team_id, created_at desc)
  where deleted_at is null and is_notice = false;
