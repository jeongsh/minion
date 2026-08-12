alter table public.fan_ratings
  add column if not exists blinded_at timestamptz,
  add column if not exists blinded_source text
    check (blinded_source is null or blinded_source in ('ai', 'report', 'admin'));

create table if not exists public.fan_rating_reactions (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.fan_ratings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('honor', 'dislike')),
  created_at timestamptz not null default now(),
  unique (rating_id, user_id)
);

create table if not exists public.fan_rating_reports (
  id uuid primary key default gen_random_uuid(),
  rating_id uuid not null references public.fan_ratings(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete cascade,
  source text not null default 'user' check (source in ('user', 'ai')),
  reason text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_fan_rating_reactions_rating_id
  on public.fan_rating_reactions(rating_id);
create index if not exists idx_fan_rating_reactions_user_id
  on public.fan_rating_reactions(user_id);
create index if not exists idx_fan_rating_reports_rating_id
  on public.fan_rating_reports(rating_id);
create index if not exists idx_fan_rating_reports_reporter_id
  on public.fan_rating_reports(reporter_id);
create unique index if not exists idx_fan_rating_reports_unique_user
  on public.fan_rating_reports(rating_id, reporter_id)
  where reporter_id is not null and source = 'user';
create unique index if not exists idx_fan_rating_reports_unique_ai
  on public.fan_rating_reports(rating_id)
  where source = 'ai' and status = 'pending';

alter table public.fan_rating_reactions enable row level security;
alter table public.fan_rating_reports enable row level security;

grant select on public.fan_rating_reactions to anon, authenticated;
grant select on public.fan_rating_reports to authenticated;
grant insert, delete on public.fan_rating_reactions to authenticated;
grant insert on public.fan_rating_reports to authenticated;
grant all on public.fan_rating_reactions, public.fan_rating_reports to service_role;

create policy "public read fan rating reactions" on public.fan_rating_reactions
  for select using (true);
create policy "users create own fan rating reactions" on public.fan_rating_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users delete own fan rating reactions" on public.fan_rating_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "users read own fan rating reports" on public.fan_rating_reports
  for select to authenticated using ((select auth.uid()) = reporter_id);
create policy "users create own fan rating reports" on public.fan_rating_reports
  for insert to authenticated with check (
    source = 'user' and (select auth.uid()) = reporter_id
  );
