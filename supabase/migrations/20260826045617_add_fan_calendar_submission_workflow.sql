-- 팬 캘린더 제보 워크플로.
-- 공개 일정과 비공개 운영 메타데이터를 분리해, 승인된 일정에서도 제보자와
-- 검토 메모가 Data API로 노출되지 않게 한다.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 서버에서 정규화한 값도 DB 경계에서 다시 확인한다. IP literal, 단일 라벨,
-- 로컬·예약 TLD, 사용자 정보가 섞인 URL은 출처로 저장하지 않는다.
create or replace function public.is_public_fan_calendar_source_url(p_url text)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  with parsed as (
    select lower(split_part(substring(lower(p_url) from '^https://([^/?#]+)'), ':', 1)) as host
  )
  select
    p_url = btrim(p_url)
    and char_length(p_url) <= 500
    and p_url ~* '^https://[^/?#@:[:space:]]+(:[0-9]{1,5})?([/?#][^[:space:]]*)?$'
    and exists (
      select 1
      from parsed
      where char_length(host) <= 253
        and host ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
        and host !~ '^[0-9.]+$'
        and host !~ '(^|\.)(example|home|internal|invalid|lan|local|localdomain|localhost|onion|test)$'
    );
$$;

revoke all on function public.is_public_fan_calendar_source_url(text)
  from public, anon, authenticated;
grant execute on function public.is_public_fan_calendar_source_url(text)
  to service_role;

alter table public.fan_calendar_events
  add column if not exists event_time time without time zone,
  add column if not exists description text,
  add column if not exists source_url text,
  add column if not exists source_kind text not null default 'admin';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_calendar_events_source_kind_chk'
      and conrelid = 'public.fan_calendar_events'::regclass
  ) then
    alter table public.fan_calendar_events
      add constraint fan_calendar_events_source_kind_chk
      check (source_kind in ('admin', 'submission'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fan_calendar_events_description_length_chk'
      and conrelid = 'public.fan_calendar_events'::regclass
  ) then
    alter table public.fan_calendar_events
      add constraint fan_calendar_events_description_length_chk
      check (description is null or char_length(description) <= 500);
  end if;
end $$;

alter table public.fan_calendar_events
  drop constraint if exists fan_calendar_events_source_url_chk;
alter table public.fan_calendar_events
  add constraint fan_calendar_events_source_url_chk
  check (
    source_url is null
    or public.is_public_fan_calendar_source_url(source_url)
  );

-- 공개 일정은 Data API에서 읽기만 허용한다. 기존 테이블의 과거 기본 권한까지
-- 명시적으로 회수해 새 메타데이터 컬럼이 클라이언트 쓰기 경로가 되지 않게 한다.
alter table public.fan_calendar_events enable row level security;
revoke all on table public.fan_calendar_events from public, anon, authenticated;
grant select on table public.fan_calendar_events to anon, authenticated;
grant select, insert, update, delete on table public.fan_calendar_events to service_role;

drop policy if exists "public read fan calendar events" on public.fan_calendar_events;
create policy "public read fan calendar events"
  on public.fan_calendar_events for select
  to anon, authenticated
  using (true);

create table public.fan_calendar_event_submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('debut', 'championship', 'custom')),
  title text not null check (
    title = btrim(title) and char_length(title) between 2 and 80
  ),
  event_date date not null check (
    event_date between date '1900-01-01' and date '2100-12-31'
  ),
  event_time time without time zone,
  is_recurring boolean not null default false,
  description text check (
    description is null
    or (description = btrim(description) and char_length(description) between 1 and 500)
  ),
  source_url text not null check (
    public.is_public_fan_calendar_source_url(source_url)
  ),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text check (
    review_note is null
    or (review_note = btrim(review_note) and char_length(review_note) between 1 and 500)
  ),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_event_id uuid unique references public.fan_calendar_events(id) on delete set null,
  discord_notified_at timestamptz,
  discord_notification_attempt_count integer not null default 0 check (
    discord_notification_attempt_count between 0 and 5
  ),
  discord_notification_last_attempt_at timestamptz,
  discord_notification_next_attempt_at timestamptz default (now() + interval '2 minutes'),
  discord_notification_error text check (
    discord_notification_error is null
    or discord_notification_error in (
      'client_error',
      'network',
      'not_configured',
      'payload_error',
      'rate_limited',
      'server_error',
      'timeout'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fan_calendar_event_submissions_review_state_chk check (
    (
      status = 'pending'
      and reviewed_at is null
      and reviewed_by is null
      and published_event_id is null
    )
    or (
      status = 'approved'
      and reviewed_at is not null
    )
    or (
      status = 'rejected'
      and reviewed_at is not null
      and published_event_id is null
    )
  ),
  constraint fan_calendar_event_submissions_discord_state_chk check (
    (
      discord_notification_attempt_count = 0
      and discord_notification_last_attempt_at is null
    )
    or (
      discord_notification_attempt_count > 0
      and discord_notification_last_attempt_at is not null
    )
  ),
  constraint fan_calendar_event_submissions_discord_delivery_chk check (
    (
      discord_notified_at is null
      or (
        discord_notification_error is null
        and discord_notification_next_attempt_at is null
        and discord_notification_attempt_count > 0
      )
    )
    and (
      discord_notification_next_attempt_at is null
      or (
        status = 'pending'
        and discord_notified_at is null
        and discord_notification_attempt_count < 5
      )
    )
  )
);

create or replace function private.stop_fan_calendar_submission_notification_retry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    new.discord_notification_next_attempt_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stop_fan_calendar_submission_notification_retry
  on public.fan_calendar_event_submissions;
create trigger stop_fan_calendar_submission_notification_retry
before update of status on public.fan_calendar_event_submissions
for each row
execute function private.stop_fan_calendar_submission_notification_retry();

create index idx_fan_calendar_event_submissions_queue
  on public.fan_calendar_event_submissions(status, created_at desc);
create index idx_fan_calendar_event_submissions_user_created
  on public.fan_calendar_event_submissions(submitted_by, created_at desc);
create index idx_fan_calendar_event_submissions_team_status
  on public.fan_calendar_event_submissions(team_id, status, created_at desc);
create index idx_fan_calendar_event_submissions_reviewed_by
  on public.fan_calendar_event_submissions(reviewed_by)
  where reviewed_by is not null;
create index idx_fan_calendar_event_submissions_notification_retry
  on public.fan_calendar_event_submissions(discord_notification_next_attempt_at, created_at)
  where status = 'pending'
    and discord_notified_at is null
    and discord_notification_next_attempt_at is not null
    and discord_notification_attempt_count < 5;

create unique index idx_fan_calendar_event_submissions_pending_duplicate
  on public.fan_calendar_event_submissions(team_id, event_date, lower(btrim(title)))
  where status = 'pending';

alter table public.fan_calendar_event_submissions enable row level security;

-- 클라이언트는 제보 큐를 읽거나 쓸 수 없다. 인증은 서버 액션에서 수행하고,
-- 서비스 역할만 아래 SECURITY INVOKER 함수와 운영 쿼리를 실행한다.
revoke all on table public.fan_calendar_event_submissions from public, anon, authenticated;
grant select, insert, update, delete on table public.fan_calendar_event_submissions to service_role;

create or replace function public.submit_fan_calendar_event_submission(
  p_team_id uuid,
  p_submitted_by uuid,
  p_event_type text,
  p_title text,
  p_event_date date,
  p_event_time time without time zone,
  p_is_recurring boolean,
  p_description text,
  p_source_url text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_submission_id uuid;
  v_today_start timestamptz := (
    date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
  );
begin
  if p_submitted_by is null then
    raise exception 'CALENDAR_SUBMISSION_LOGIN_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submitted_by::text, 0));

  if exists (
    select 1
    from public.fan_calendar_event_submissions
    where submitted_by = p_submitted_by
      and created_at >= now() - interval '30 seconds'
  ) then
    raise exception 'CALENDAR_SUBMISSION_COOLDOWN';
  end if;

  if (
    select count(*)
    from public.fan_calendar_event_submissions
    where submitted_by = p_submitted_by
      and created_at >= v_today_start
  ) >= 3 then
    raise exception 'CALENDAR_SUBMISSION_DAILY_LIMIT';
  end if;

  if (
    select count(*)
    from public.fan_calendar_event_submissions
    where submitted_by = p_submitted_by
      and status = 'pending'
  ) >= 3 then
    raise exception 'CALENDAR_SUBMISSION_PENDING_LIMIT';
  end if;

  insert into public.fan_calendar_event_submissions (
    team_id,
    submitted_by,
    event_type,
    title,
    event_date,
    event_time,
    is_recurring,
    description,
    source_url
  ) values (
    p_team_id,
    p_submitted_by,
    p_event_type,
    p_title,
    p_event_date,
    p_event_time,
    p_is_recurring,
    p_description,
    p_source_url
  )
  returning id into v_submission_id;

  return v_submission_id;
end;
$$;

-- 짧은 트랜잭션에서 due row를 claim하고 lease를 미래로 옮긴다. 겹친 cron
-- 실행은 SKIP LOCKED와 갱신된 lease 때문에 같은 제보를 동시에 전송하지 않는다.
create or replace function public.claim_fan_calendar_submission_notifications(
  p_limit integer default 10
)
returns table(submission_id uuid)
language sql
volatile
security invoker
set search_path = ''
as $$
  with due as (
    select submission.id
    from public.fan_calendar_event_submissions as submission
    where submission.status = 'pending'
      and submission.discord_notified_at is null
      and submission.discord_notification_next_attempt_at is not null
      and submission.discord_notification_next_attempt_at <= now()
      and submission.discord_notification_attempt_count < 5
    order by submission.discord_notification_next_attempt_at, submission.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 10), 1), 50)
  )
  update public.fan_calendar_event_submissions as submission
  set discord_notification_next_attempt_at = now() + interval '10 minutes',
      updated_at = now()
  from due
  where submission.id = due.id
  returning submission.id;
$$;

create or replace function public.approve_fan_calendar_event_submission(
  p_submission_id uuid,
  p_reviewed_by uuid,
  p_review_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_submission public.fan_calendar_event_submissions%rowtype;
  v_event_id uuid;
begin
  if p_reviewed_by is null then
    raise exception 'CALENDAR_SUBMISSION_REVIEWER_REQUIRED';
  end if;

  select * into v_submission
  from public.fan_calendar_event_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception 'CALENDAR_SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status = 'approved' and v_submission.published_event_id is not null then
    return v_submission.published_event_id;
  end if;

  if v_submission.status <> 'pending' then
    raise exception 'CALENDAR_SUBMISSION_NOT_PENDING';
  end if;

  insert into public.fan_calendar_events (
    event_type,
    team_id,
    title,
    event_date,
    event_time,
    is_recurring,
    description,
    source_url,
    source_kind
  ) values (
    v_submission.event_type,
    v_submission.team_id,
    v_submission.title,
    v_submission.event_date,
    v_submission.event_time,
    v_submission.is_recurring,
    v_submission.description,
    v_submission.source_url,
    'submission'
  )
  returning id into v_event_id;

  update public.fan_calendar_event_submissions
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = p_reviewed_by,
      review_note = nullif(btrim(p_review_note), ''),
      published_event_id = v_event_id,
      updated_at = now()
  where id = p_submission_id;

  return v_event_id;
end;
$$;

revoke all on function public.submit_fan_calendar_event_submission(
  uuid, uuid, text, text, date, time without time zone, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.submit_fan_calendar_event_submission(
  uuid, uuid, text, text, date, time without time zone, boolean, text, text
) to service_role;

revoke all on function public.claim_fan_calendar_submission_notifications(integer)
  from public, anon, authenticated;
grant execute on function public.claim_fan_calendar_submission_notifications(integer)
  to service_role;

revoke all on function public.approve_fan_calendar_event_submission(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.approve_fan_calendar_event_submission(
  uuid, uuid, text
) to service_role;

-- 고빈도 재시도는 기존 자동화와 같은 Supabase Cron → 인증된 Next route
-- 흐름을 쓴다. Vault에는 기존 자동화용 URL/secret/bypass 이름을 재사용한다.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function private.invoke_fan_calendar_notification_retry()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site_url text;
  v_cron_secret text;
  v_vercel_bypass text;
  v_request_id bigint;
begin
  select decrypted_secret into v_site_url
  from vault.decrypted_secrets
  where name = 'lckhub_automation_url';

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets
  where name = 'lckhub_automation_secret';

  select decrypted_secret into v_vercel_bypass
  from vault.decrypted_secrets
  where name = 'lckhub_vercel_bypass';

  if nullif(v_site_url, '') is null
    or nullif(v_cron_secret, '') is null
    or nullif(v_vercel_bypass, '') is null then
    raise exception 'Fan calendar notification automation Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/fan-calendar-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'X-Vercel-Protection-Bypass', v_vercel_bypass,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_fan_calendar_notification_retry()
  from public, anon, authenticated;

select cron.schedule(
  'fan-calendar-notification-retry-every-five-minutes',
  '*/5 * * * *',
  'select private.invoke_fan_calendar_notification_retry()'
);

select cron.schedule(
  'cleanup-fan-calendar-notification-cron-history',
  '37 3 * * *',
  $$
    delete from cron.job_run_details
    where jobid = (
      select jobid
      from cron.job
      where jobname = 'fan-calendar-notification-retry-every-five-minutes'
    )
      and end_time < now() - interval '7 days'
  $$
);
