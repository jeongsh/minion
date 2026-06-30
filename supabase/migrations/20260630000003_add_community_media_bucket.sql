-- 게시판 에디터 이미지 업로드용 공개 스토리지 버킷
-- 적용은 사용자가 수동으로 수행한다(이 트랙은 원격 DB에 적용하지 않음).
-- 업로드는 service-role(/api/community/upload)로만 수행하고, 읽기는 공개로 둔다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  20971520, -- 20MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
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
      and policyname = 'community-media public read'
  ) then
    create policy "community-media public read"
      on storage.objects for select
      using (bucket_id = 'community-media');
  end if;
end $$;
