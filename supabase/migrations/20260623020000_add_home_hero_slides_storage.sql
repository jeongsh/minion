insert into storage.buckets (id, name, public)
values ('home-hero-slides', 'home-hero-slides', true)
on conflict (id) do update set public = true;

create policy "public read home hero slide images"
  on storage.objects
  for select
  using (bucket_id = 'home-hero-slides');
