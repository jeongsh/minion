-- 웹 쿠키/앱 설치 ID를 해시한 키로 비회원 투표와 이미지 업로드를 추적한다.

alter table public.post_poll_votes
  add column if not exists voter_key text;

update public.post_poll_votes
set voter_key = 'account:' || user_id::text
where voter_key is null and user_id is not null;

alter table public.post_poll_votes
  drop constraint if exists post_poll_votes_pkey,
  drop constraint if exists post_poll_votes_identity_check;

alter table public.post_poll_votes
  alter column user_id drop not null,
  add constraint post_poll_votes_identity_check check (
    user_id is not null or char_length(voter_key) between 32 and 160
  ),
  add primary key (poll_id, voter_key);

create index if not exists idx_post_poll_votes_user
  on public.post_poll_votes(user_id)
  where user_id is not null;

-- 투표 집계는 서버 API를 통해서만 제공한다. 익명 식별 키를 클라이언트에 노출하지 않는다.
drop policy if exists "public read post poll votes" on public.post_poll_votes;
revoke all on table public.post_poll_votes from anon, authenticated;

alter table public.community_uploads
  add column if not exists guest_key text,
  alter column user_id drop not null,
  drop constraint if exists community_uploads_identity_check;

alter table public.community_uploads
  add constraint community_uploads_identity_check check (
    user_id is not null or char_length(guest_key) between 32 and 128
  );

create index if not exists idx_community_uploads_guest_key_created_at
  on public.community_uploads(guest_key, created_at desc)
  where guest_key is not null;

drop function if exists public.record_community_upload(
  uuid, text, text, text, text, text, integer, integer, integer, integer, integer
);

create function public.record_community_upload(
  p_user_id uuid,
  p_guest_key text,
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
  v_owner_key text;
begin
  if p_user_id is null and (p_guest_key is null or char_length(p_guest_key) not between 32 and 128) then
    raise exception 'A valid upload owner is required.';
  end if;

  v_owner_key := coalesce('account:' || p_user_id::text, 'guest:' || p_guest_key);
  perform pg_advisory_xact_lock(hashtext(v_owner_key));
  v_day_start := date_trunc('day', now() at time zone 'utc') at time zone 'utc';

  select count(*) into v_count
  from public.community_uploads
  where created_at >= v_day_start
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_user_id is null and guest_key = p_guest_key)
    );

  if v_count >= p_daily_limit then
    return query select false, v_count;
    return;
  end if;

  insert into public.community_uploads (
    user_id, guest_key, bucket_id, object_path, public_url,
    original_content_type, stored_content_type, original_bytes,
    stored_bytes, width, height, status
  ) values (
    p_user_id, p_guest_key, p_bucket_id, p_object_path, p_public_url,
    p_original_content_type, p_stored_content_type, p_original_bytes,
    p_stored_bytes, p_width, p_height, 'uploaded'
  );

  return query select true, v_count + 1;
end;
$$;

revoke all on function public.record_community_upload(
  uuid, text, text, text, text, text, text, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_community_upload(
  uuid, text, text, text, text, text, text, integer, integer, integer, integer, integer
) to service_role;
