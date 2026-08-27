-- AI 프리뷰는 생성 성공 기록이자 경기 시작 후에도 유지해야 하는 캐시다.
-- 애플리케이션은 upsert만 사용하므로 service_role의 직접 DELETE 권한은 필요 없다.
-- 부모 경기 삭제 시 FK의 ON DELETE CASCADE는 그대로 동작한다.
revoke delete on table public.match_ai_previews from service_role;

comment on table public.match_ai_previews is
  'Caches generated match previews. Application roles may upsert but cannot directly delete successful previews.';
