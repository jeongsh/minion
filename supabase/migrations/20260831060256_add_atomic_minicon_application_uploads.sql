create table public.minicon_upload_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  public_url text,
  mime_type text not null,
  byte_size integer not null,
  width integer not null,
  height integer not null,
  status text not null default 'reserved',
  upload_date date not null,
  created_at timestamptz not null default now(),
  uploaded_at timestamptz,
  claimed_at timestamptz,
  claimed_pack_id uuid references public.minicon_packs(id) on delete set null,
  constraint minicon_upload_receipts_storage_path_check
    check (
      storage_path ~ (
        '^' || user_id::text
        || '/applications/[0-9]{4}-[0-9]{2}-[0-9]{2}/'
        || '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
        || '\.(png|jpg|gif)$'
      )
    ),
  constraint minicon_upload_receipts_public_url_check
    check (public_url is null or char_length(public_url) between 1 and 2048),
  constraint minicon_upload_receipts_mime_type_check
    check (mime_type in ('image/png', 'image/jpeg', 'image/gif')),
  constraint minicon_upload_receipts_byte_size_check
    check (byte_size between 1 and 2097152),
  constraint minicon_upload_receipts_dimensions_check
    check (width = 200 and height = 200),
  constraint minicon_upload_receipts_status_check
    check (status in ('reserved', 'uploaded', 'claimed', 'cleanup_pending', 'cleaned', 'failed')),
  constraint minicon_upload_receipts_state_check
    check (
      (status in ('reserved', 'cleanup_pending', 'cleaned', 'failed') and claimed_pack_id is null)
      or (status = 'uploaded' and public_url is not null and claimed_pack_id is null)
      or (status = 'claimed' and public_url is not null and claimed_pack_id is not null)
    )
);

create index minicon_upload_receipts_user_date_idx
  on public.minicon_upload_receipts(user_id, upload_date, created_at);

create index minicon_upload_receipts_unclaimed_idx
  on public.minicon_upload_receipts(created_at)
  where status in ('reserved', 'uploaded');

create index minicon_upload_receipts_claimed_pack_idx
  on public.minicon_upload_receipts(claimed_pack_id)
  where claimed_pack_id is not null;

alter table public.minicon_upload_receipts enable row level security;

revoke all on table public.minicon_upload_receipts from public, anon, authenticated;
grant all on table public.minicon_upload_receipts to service_role;

create or replace function public.reserve_minicon_upload(
  p_user_id uuid,
  p_extension text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns table(receipt_id uuid, storage_path text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_upload_date date := timezone('Asia/Seoul', statement_timestamp())::date;
  v_object_id uuid := gen_random_uuid();
  v_path text;
begin
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'MINICON_AUTH_REQUIRED';
  end if;

  if not (
    (p_extension = 'png' and p_mime_type = 'image/png')
    or (p_extension = 'jpg' and p_mime_type = 'image/jpeg')
    or (p_extension = 'gif' and p_mime_type = 'image/gif')
  ) then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_UPLOAD';
  end if;

  if p_byte_size not between 1 and 2097152 or p_width <> 200 or p_height <> 200 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_UPLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('minicon-application:' || p_user_id::text, 0)
  );

  if (
    select count(*)
    from public.minicon_packs
    where creator_id = p_user_id
      and status = 'pending_review'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'MINICON_PENDING_LIMIT';
  end if;

  if (
    select count(*)
    from public.minicon_upload_receipts
    where user_id = p_user_id
      and upload_date = v_upload_date
  ) >= 600 then
    raise exception using errcode = 'P0001', message = 'MINICON_DAILY_UPLOAD_LIMIT';
  end if;

  v_path := p_user_id::text || '/applications/' || v_upload_date::text || '/'
    || v_object_id::text || '.' || p_extension;

  return query
  insert into public.minicon_upload_receipts (
    user_id,
    storage_path,
    mime_type,
    byte_size,
    width,
    height,
    upload_date
  )
  values (
    p_user_id,
    v_path,
    p_mime_type,
    p_byte_size,
    p_width,
    p_height,
    v_upload_date
  )
  returning id, minicon_upload_receipts.storage_path;
end;
$$;

create or replace function public.complete_minicon_upload(
  p_user_id uuid,
  p_receipt_id uuid,
  p_public_url text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  if p_public_url is null or char_length(p_public_url) not between 1 and 2048 then
    return false;
  end if;

  update public.minicon_upload_receipts
  set
    status = 'uploaded',
    public_url = p_public_url,
    uploaded_at = statement_timestamp()
  where id = p_receipt_id
    and user_id = p_user_id
    and status = 'reserved';

  v_updated := found;
  return v_updated;
end;
$$;

create or replace function public.fail_minicon_upload(
  p_user_id uuid,
  p_receipt_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.minicon_upload_receipts
  set status = 'failed'
  where id = p_receipt_id
    and user_id = p_user_id
    and status = 'reserved';

  v_updated := found;
  return v_updated;
end;
$$;

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
  set status = 'cleanup_pending'
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
  set status = 'cleaned'
  where user_id = p_user_id
    and id = any(p_receipt_ids)
    and status = 'cleanup_pending';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.submit_minicon_application(
  p_user_id uuid,
  p_name text,
  p_description text,
  p_rights_confirmed boolean,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ordinality bigint;
  v_receipt_text text;
  v_receipt_id uuid;
  v_receipt_ids uuid[] := array[]::uuid[];
  v_item_names text[] := array[]::text[];
  v_receipt_count integer;
  v_pack_id uuid;
  v_cover_url text;
  v_submitted_at timestamptz := statement_timestamp();
begin
  if p_user_id is null then
    raise exception using errcode = 'P0001', message = 'MINICON_AUTH_REQUIRED';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_NAME';
  end if;
  if char_length(trim(coalesce(p_description, ''))) > 300 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_DESCRIPTION';
  end if;
  if p_rights_confirmed is distinct from true then
    raise exception using errcode = 'P0001', message = 'MINICON_RIGHTS_REQUIRED';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_ITEM_COUNT';
  end if;
  if jsonb_array_length(p_items) not between 10 and 200 then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_ITEM_COUNT';
  end if;

  for v_item, v_ordinality in
    select value, ordinality
    from jsonb_array_elements(p_items) with ordinality
  loop
    v_receipt_text := v_item ->> 'receiptId';
    if v_receipt_text is null
      or v_receipt_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception using errcode = 'P0001', message = 'MINICON_INVALID_UPLOADS';
    end if;

    v_receipt_id := v_receipt_text::uuid;
    if v_receipt_id = any(v_receipt_ids) then
      raise exception using errcode = 'P0001', message = 'MINICON_DUPLICATE_UPLOADS';
    end if;

    v_receipt_ids := pg_catalog.array_append(v_receipt_ids, v_receipt_id);
    v_item_names := pg_catalog.array_append(
      v_item_names,
      coalesce(
        nullif(pg_catalog.left(trim(v_item ->> 'name'), 20), ''),
        '미니콘 ' || v_ordinality::text
      )
    );
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('minicon-application:' || p_user_id::text, 0)
  );

  if (
    select count(*)
    from public.minicon_packs
    where creator_id = p_user_id
      and status = 'pending_review'
  ) >= 3 then
    raise exception using errcode = 'P0001', message = 'MINICON_PENDING_LIMIT';
  end if;

  perform 1
  from public.minicon_upload_receipts
  where user_id = p_user_id
    and id = any(v_receipt_ids)
    and status = 'uploaded'
    and public_url is not null
    and created_at >= statement_timestamp() - interval '48 hours'
  for update;
  get diagnostics v_receipt_count = row_count;

  if v_receipt_count <> pg_catalog.array_length(v_receipt_ids, 1) then
    raise exception using errcode = 'P0001', message = 'MINICON_INVALID_UPLOADS';
  end if;

  select public_url
  into v_cover_url
  from public.minicon_upload_receipts
  where id = v_receipt_ids[1];

  insert into public.minicon_packs (
    slug,
    name,
    description,
    creator_id,
    status,
    cover_url,
    is_official,
    submitted_at,
    rights_confirmed_at
  )
  values (
    'minicon-application-' || gen_random_uuid()::text,
    trim(p_name),
    trim(coalesce(p_description, '')),
    p_user_id,
    'pending_review',
    v_cover_url,
    false,
    v_submitted_at,
    v_submitted_at
  )
  returning id into v_pack_id;

  insert into public.minicon_items (
    pack_id,
    name,
    image_url,
    storage_path,
    mime_type,
    byte_size,
    width,
    height,
    sort_order
  )
  select
    v_pack_id,
    v_item_names[item.ordinality::integer],
    receipt.public_url,
    receipt.storage_path,
    receipt.mime_type,
    receipt.byte_size,
    receipt.width,
    receipt.height,
    item.ordinality::integer - 1
  from unnest(v_receipt_ids) with ordinality as item(receipt_id, ordinality)
  join public.minicon_upload_receipts receipt on receipt.id = item.receipt_id
  order by item.ordinality;

  update public.minicon_upload_receipts
  set
    status = 'claimed',
    claimed_at = v_submitted_at,
    claimed_pack_id = v_pack_id
  where id = any(v_receipt_ids);

  return v_pack_id;
end;
$$;

revoke all on function public.reserve_minicon_upload(uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.complete_minicon_upload(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.fail_minicon_upload(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.request_minicon_upload_cleanup(uuid, uuid[])
  from public, anon, authenticated;
revoke all on function public.complete_minicon_upload_cleanup(uuid, uuid[])
  from public, anon, authenticated;
revoke all on function public.submit_minicon_application(uuid, text, text, boolean, jsonb)
  from public, anon, authenticated;

grant execute on function public.reserve_minicon_upload(uuid, text, text, integer, integer, integer)
  to service_role;
grant execute on function public.complete_minicon_upload(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_minicon_upload(uuid, uuid)
  to service_role;
grant execute on function public.request_minicon_upload_cleanup(uuid, uuid[])
  to service_role;
grant execute on function public.complete_minicon_upload_cleanup(uuid, uuid[])
  to service_role;
grant execute on function public.submit_minicon_application(uuid, text, text, boolean, jsonb)
  to service_role;

comment on table public.minicon_upload_receipts is
  '서버가 검증한 신청용 미니콘 업로드의 소유권·메타데이터·소비 상태';
comment on column public.minicon_packs.review_note is
  '신청자에게 전달하는 심사 안내. Data API에는 비공개이며 관리자와 해당 신청자의 서버 화면에서만 사용한다.';
comment on function public.submit_minicon_application(uuid, text, text, boolean, jsonb) is
  '검증된 업로드 영수증을 소비해 미니콘 패키지와 아이템을 원자적으로 생성한다.';
