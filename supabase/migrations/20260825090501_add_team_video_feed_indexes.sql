-- getFanVideoFeed()도 같은 팬 페이지(/fan/[teamSlug] 등)에서 team_id로 필터링 후
-- published_at으로 정렬하는데, team_id/published_at이 각각 단일 인덱스라 합쳐서
-- 못 쓰고 있었다(team_videos 8,018회 스캔, 평균 1,223행/회). 복합 인덱스로 교체.
create index if not exists idx_team_videos_team_published
  on public.team_videos (team_id, published_at desc);

create index if not exists idx_player_videos_team_published
  on public.player_videos (team_id, published_at desc);
