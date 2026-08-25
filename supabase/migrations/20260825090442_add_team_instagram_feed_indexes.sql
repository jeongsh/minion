-- getTeamInstagramFeed()이 /fan/[teamSlug], /fan/[teamSlug]/instagram, /teams, 모바일 팀 API 등
-- 트래픽이 많은 화면에서 매번 team_id+platform로 필터링 후 published_at/posted_at로 정렬하는데,
-- 정렬 컬럼을 포함한 인덱스가 없어 거의 전체 스캔이 반복되고 있었다(team_social_posts 3,359회 스캔,
-- 평균 3,366행/회 — 테이블 전체 대부분을 매번 읽음).
create index if not exists idx_team_social_posts_team_platform_published
  on public.team_social_posts (team_id, platform, published_at desc);

create index if not exists idx_player_social_posts_team_platform_posted
  on public.player_social_posts (team_id, platform, posted_at desc);
