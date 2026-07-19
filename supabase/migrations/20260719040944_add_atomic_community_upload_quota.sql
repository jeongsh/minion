create or replace function public.record_community_upload(
  p_user_id uuid,
  p_bucket_id text,
  p_object_path text,
  p_public_url text,
  p_original_content_type text,
  p_stored_content_type text,
  p_original_bytes integer,
  p_stored_bytes integer,
  p_width integer,
  p_height integer,
  p_daily_limit integer
)
returns table(allowed boolean, upload_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_day_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(p_user_id::text));

  v_day_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  select count(*) into v_count
  from public.community_uploads
  where user_id = p_user_id
    and created_at >= v_day_start;

  if v_count >= p_daily_limit then
    return query select false, v_count;
    return;
  end if;

  insert into public.community_uploads (
    user_id,
    bucket_id,
    object_path,
    public_url,
    original_content_type,
    stored_content_type,
    original_bytes,
    stored_bytes,
    width,
    height,
    status
  )
  values (
    p_user_id,
    p_bucket_id,
    p_object_path,
    p_public_url,
    p_original_content_type,
    p_stored_content_type,
    p_original_bytes,
    p_stored_bytes,
    p_width,
    p_height,
    'uploaded'
  );

  return query select true, v_count + 1;
end;
$$;

revoke all on function public.record_community_upload(
  uuid, text, text, text, text, text, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_community_upload(
  uuid, text, text, text, text, text, integer, integer, integer, integer, integer
) to service_role;
