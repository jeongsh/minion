-- 세트별 다시보기 VOD. 롤이스포츠 API에서 자동 동기화하며,
-- 자동으로 못 채우는 대회는 matches.vod_url / vod_thumbnail_url 로 수동 보완한다.
alter table sets
  add column if not exists vod_url text,
  add column if not exists vod_provider text,
  add column if not exists vod_start_seconds integer,
  add column if not exists vod_synced_at timestamptz;

-- 수동 입력 경기(ENC 등)용 썸네일. vod_url 은 이미 존재.
alter table matches
  add column if not exists vod_thumbnail_url text;

-- 일정 목록에서 "VOD 있는 경기"를 빠르게 추리기 위한 부분 인덱스.
create index if not exists sets_match_id_vod_idx
  on sets (match_id)
  where vod_url is not null;
