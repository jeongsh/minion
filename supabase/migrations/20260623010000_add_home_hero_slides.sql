create table if not exists public.home_hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text not null,
  link_url text,
  order_index integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_home_hero_slides_order
  on public.home_hero_slides(is_active, order_index, created_at desc);

alter table public.home_hero_slides enable row level security;

grant select on public.home_hero_slides to anon, authenticated;
grant all on public.home_hero_slides to service_role;

drop policy if exists "public read home hero slides" on public.home_hero_slides;
create policy "public read home hero slides"
  on public.home_hero_slides
  for select
  using (true);
