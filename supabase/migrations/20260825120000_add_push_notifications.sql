create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (expo_push_token)
);

create index if not exists idx_push_tokens_user_id on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "users manage own push tokens"
  on public.push_tokens for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 같은 경기에 중복으로 "곧 시작" 푸시를 보내지 않기 위한 발송 기록.
alter table public.matches
  add column if not exists start_notification_sent_at timestamptz;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_match_start_notifications()
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
    raise exception 'Match start notification Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/match-start-notifications',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'X-Vercel-Protection-Bypass', v_vercel_bypass,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 25000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_match_start_notifications()
  from public, anon, authenticated;

select cron.schedule(
  'match-start-notifications-every-minute',
  '* * * * *',
  'select private.invoke_match_start_notifications()'
);

select cron.schedule(
  'cleanup-match-start-notifications-cron-history',
  '37 3 * * *',
  $$
    delete from cron.job_run_details
    where jobid = (
      select jobid
      from cron.job
      where jobname = 'match-start-notifications-every-minute'
    )
      and end_time < now() - interval '7 days'
  $$
);
