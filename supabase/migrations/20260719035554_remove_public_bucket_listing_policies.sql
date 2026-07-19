-- Public buckets serve known object URLs without storage.objects SELECT policies.
-- Removing these broad policies prevents public clients from enumerating bucket contents.
drop policy if exists "community-media public read" on storage.objects;
drop policy if exists "instagram-media public read" on storage.objects;
drop policy if exists "public read home hero slide images" on storage.objects;
drop policy if exists "public read player profile images" on storage.objects;
