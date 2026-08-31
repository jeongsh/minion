alter table public.minicon_upload_receipts
  drop constraint minicon_upload_receipts_claimed_pack_id_fkey,
  add constraint minicon_upload_receipts_claimed_pack_id_fkey
    foreign key (claimed_pack_id)
    references public.minicon_packs(id)
    on delete cascade;

create or replace function public.replace_user_minicon_packs(
  p_user_id uuid,
  p_pack_ids uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pack_count integer;
begin
  if p_user_id is null
    or coalesce(pg_catalog.array_length(p_pack_ids, 1), 0) not between 1 and 200
    or pg_catalog.array_position(p_pack_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_SELECTION';
  end if;

  select count(distinct pack_id)
  into v_pack_count
  from unnest(p_pack_ids) as selection(pack_id);
  if v_pack_count <> pg_catalog.array_length(p_pack_ids, 1) then
    raise exception using errcode = 'P0001', message = 'MINICON_DUPLICATE_SELECTION';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('minicon-settings:' || p_user_id::text, 0)
  );

  perform 1
  from public.minicon_packs
  where id = any(p_pack_ids)
  for share;

  select count(*)
  into v_pack_count
  from public.minicon_packs
  where id = any(p_pack_ids)
    and status = 'published';
  if v_pack_count <> pg_catalog.array_length(p_pack_ids, 1) then
    raise exception using errcode = 'P0001', message = 'MINICON_UNAVAILABLE_SELECTION';
  end if;

  delete from public.user_minicon_packs
  where user_id = p_user_id;

  insert into public.user_minicon_packs (user_id, pack_id, sort_order)
  select p_user_id, selection.pack_id, selection.ordinality::integer - 1
  from unnest(p_pack_ids) with ordinality as selection(pack_id, ordinality)
  order by selection.ordinality;

  return pg_catalog.array_length(p_pack_ids, 1);
end;
$$;

revoke all on function public.replace_user_minicon_packs(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.replace_user_minicon_packs(uuid, uuid[])
  to service_role;

comment on function public.replace_user_minicon_packs(uuid, uuid[]) is
  '공개 패키지 검증과 사용자 미니콘 선택 목록 교체를 원자적으로 처리한다.';
