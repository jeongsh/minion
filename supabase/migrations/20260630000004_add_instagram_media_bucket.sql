-- 인스타그램 게시물 이미지 영구 보관용 공개 스토리지 버킷.
-- 인스타 CDN URL은 서명·만료형이라 그대로 저장하면 시간이 지나 엑박이 된다.
-- 동기화 시점에 이미지를 이 버킷으로 내려받아 만료되지 않는 공개 URL을 저장한다.
-- 업로드는 service-role(동기화 스크립트)로만 수행하고, 읽기는 공개로 둔다.
-- 적용은 사용자가 수동으로 수행한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instagram-media',
  'instagram-media',
  true,
  20971520, -- 20MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 공개 읽기 정책(공개 버킷이라 객체 조회 허용).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'instagram-media public read'
  ) then
    create policy "instagram-media public read"
      on storage.objects for select
      using (bucket_id = 'instagram-media');
  end if;
end $$;
