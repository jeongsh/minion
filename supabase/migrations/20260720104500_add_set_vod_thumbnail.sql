-- 세트 다시보기 썸네일. 숲 VOD 페이지의 og:image 에서 수집한다.
-- 임베드 URL 은 vod_url + "/embed" 규칙이라 별도 저장하지 않는다.
alter table sets
  add column if not exists vod_thumbnail_url text;
