alter table public.minicon_upload_receipts
  add column cleanup_requested_at timestamptz,
  add column cleaned_at timestamptz,
  drop constraint minicon_upload_receipts_user_id_fkey,
  alter column user_id drop not null,
  add constraint minicon_upload_receipts_user_id_fkey
    foreign key (user_id)
    references auth.users(id)
    on delete set null;

drop index minicon_upload_receipts_unclaimed_idx;
create index minicon_upload_receipts_unclaimed_idx
  on public.minicon_upload_receipts(created_at)
  where status in ('reserved', 'uploaded', 'cleanup_pending', 'failed');

create or replace function public.request_minicon_upload_cleanup(
  p_user_id uuid,
  p_receipt_ids uuid[]
)
returns table(receipt_id uuid, storage_path text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_user_id is null
    or coalesce(pg_catalog.array_length(p_receipt_ids, 1), 0) = 0
    or pg_catalog.array_length(p_receipt_ids, 1) > 200 then
    return;
  end if;

  update public.minicon_upload_receipts
  set
    status = 'cleanup_pending',
    cleanup_requested_at = statement_timestamp()
  where user_id = p_user_id
    and id = any(p_receipt_ids)
    and status in ('reserved', 'uploaded', 'failed');

  return query
  select receipt.id, receipt.storage_path
  from public.minicon_upload_receipts receipt
  where receipt.user_id = p_user_id
    and receipt.id = any(p_receipt_ids)
    and receipt.status = 'cleanup_pending';
end;
$$;

create or replace function public.complete_minicon_upload_cleanup(
  p_user_id uuid,
  p_receipt_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user_id is null
    or coalesce(pg_catalog.array_length(p_receipt_ids, 1), 0) = 0
    or pg_catalog.array_length(p_receipt_ids, 1) > 200 then
    return 0;
  end if;

  update public.minicon_upload_receipts
  set
    status = 'cleaned',
    cleaned_at = statement_timestamp()
  where user_id = p_user_id
    and id = any(p_receipt_ids)
    and status = 'cleanup_pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.claim_stale_minicon_upload_cleanup(
  p_limit integer default 500
)
returns table(receipt_id uuid, storage_path text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit not between 1 and 1000 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_CLEANUP_LIMIT';
  end if;

  return query
  update public.minicon_upload_receipts receipt
  set
    status = 'cleanup_pending',
    cleanup_requested_at = statement_timestamp()
  where receipt.id in (
    select candidate.id
    from public.minicon_upload_receipts candidate
    where (
      (
        candidate.status in ('reserved', 'uploaded', 'failed')
        and candidate.created_at < statement_timestamp() - interval '48 hours'
      )
      or (
        candidate.status = 'cleanup_pending'
        and coalesce(candidate.cleanup_requested_at, candidate.created_at)
          < statement_timestamp() - interval '1 hour'
      )
    )
    order by candidate.created_at
    limit p_limit
    for update skip locked
  )
  returning receipt.id, receipt.storage_path;
end;
$$;

create or replace function public.complete_stale_minicon_upload_cleanup(
  p_receipt_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(pg_catalog.array_length(p_receipt_ids, 1), 0) = 0
    or pg_catalog.array_length(p_receipt_ids, 1) > 1000 then
    return 0;
  end if;

  update public.minicon_upload_receipts
  set
    status = 'cleaned',
    cleaned_at = statement_timestamp()
  where id = any(p_receipt_ids)
    and status = 'cleanup_pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.prune_cleaned_minicon_upload_receipts(
  p_limit integer default 1000
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_limit not between 1 and 5000 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_CLEANUP_LIMIT';
  end if;

  with deleted as (
    delete from public.minicon_upload_receipts receipt
    where receipt.id in (
      select candidate.id
      from public.minicon_upload_receipts candidate
      where candidate.status = 'cleaned'
        and candidate.cleaned_at < statement_timestamp() - interval '7 days'
      order by candidate.cleaned_at
      limit p_limit
      for update skip locked
    )
    returning 1
  )
  select count(*) into v_count from deleted;

  return v_count;
end;
$$;

revoke all on function public.claim_stale_minicon_upload_cleanup(integer)
  from public, anon, authenticated;
revoke all on function public.complete_stale_minicon_upload_cleanup(uuid[])
  from public, anon, authenticated;
revoke all on function public.prune_cleaned_minicon_upload_receipts(integer)
  from public, anon, authenticated;

grant execute on function public.claim_stale_minicon_upload_cleanup(integer)
  to service_role;
grant execute on function public.complete_stale_minicon_upload_cleanup(uuid[])
  to service_role;
grant execute on function public.prune_cleaned_minicon_upload_receipts(integer)
  to service_role;

comment on function public.claim_stale_minicon_upload_cleanup(integer) is
  '48시간 지난 미사용 신청 업로드를 Storage API 정리 대기열로 원자적으로 가져온다.';
comment on column public.minicon_upload_receipts.cleanup_requested_at is
  'Storage API 삭제를 요청한 최근 시각. 1시간 뒤 재시도할 수 있다.';
