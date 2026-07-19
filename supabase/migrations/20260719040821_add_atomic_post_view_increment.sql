create or replace function public.increment_community_post_view_count(p_post_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_view_count integer;
begin
  update public.community_posts
  set view_count = view_count + 1
  where id = p_post_id
    and deleted_at is null
  returning view_count into v_view_count;

  return v_view_count;
end;
$$;

revoke all on function public.increment_community_post_view_count(uuid)
  from public, anon, authenticated;
grant execute on function public.increment_community_post_view_count(uuid)
  to service_role;
