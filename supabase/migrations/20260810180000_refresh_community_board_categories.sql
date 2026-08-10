-- Align legacy community posts with the refreshed hub/team category sets.
-- The category catalog itself is application-owned (lib/community/boards.ts).

update public.community_posts
set board_type = case
  when site_scope = 'hub' and board_type = 'reviews' then 'analysis'
  when site_scope = 'hub' and board_type in ('humor', 'onsite') then 'free'
  when site_scope = 'team' and board_type = 'reviews' then 'discussion'
  when site_scope = 'team' and board_type = 'cheer' then 'free'
  else board_type
end
where
  (site_scope = 'hub' and board_type in ('humor', 'reviews', 'onsite'))
  or (site_scope = 'team' and board_type in ('cheer', 'reviews'));
