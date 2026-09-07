create table if not exists public.community_post_views (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  ip_key text not null,
  viewed_at timestamptz not null default now(),
  primary key (post_id, ip_key)
);

create index if not exists idx_community_post_views_viewed_at
  on public.community_post_views(viewed_at);

alter table public.community_post_views enable row level security;

revoke all on table public.community_post_views from anon, authenticated;
grant select, insert, delete on table public.community_post_views to service_role;

drop function if exists public.increment_community_post_view_count(uuid);

create or replace function public.increment_community_post_view_count(
  p_post_id uuid,
  p_viewer_ip_key text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted_count integer;
  v_view_count integer;
begin
  if p_viewer_ip_key is null or trim(p_viewer_ip_key) = '' then
    select view_count into v_view_count
    from public.community_posts
    where id = p_post_id
      and deleted_at is null;

    return v_view_count;
  end if;

  insert into public.community_post_views(post_id, ip_key)
  select p_post_id, p_viewer_ip_key
  where exists (
    select 1
    from public.community_posts
    where id = p_post_id
      and deleted_at is null
  )
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count > 0 then
    update public.community_posts
    set view_count = view_count + 1
    where id = p_post_id
      and deleted_at is null
    returning view_count into v_view_count;
  else
    select view_count into v_view_count
    from public.community_posts
    where id = p_post_id
      and deleted_at is null;
  end if;

  return v_view_count;
end;
$$;

revoke all on function public.increment_community_post_view_count(uuid, text)
  from public, anon, authenticated;
grant execute on function public.increment_community_post_view_count(uuid, text)
  to service_role;
