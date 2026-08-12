create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_match_vod_automation(p_mode text default 'recent')
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
  if p_mode not in ('recent', 'backfill') then
    raise exception 'Unsupported match VOD automation mode: %', p_mode;
  end if;

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
    raise exception 'Match VOD automation Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/match-vods?mode=' || p_mode,
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

revoke all on function private.invoke_match_vod_automation(text)
  from public, anon, authenticated;

-- Every two hours: completed at least three hours ago, looking back 48 hours.
select cron.schedule(
  'match-vod-automation-every-two-hours',
  '0 */2 * * *',
  $$select private.invoke_match_vod_automation('recent')$$
);

-- 06:00 KST (21:00 UTC): retry older omissions from the last 30 days.
select cron.schedule(
  'match-vod-automation-daily-backfill',
  '0 21 * * *',
  $$select private.invoke_match_vod_automation('backfill')$$
);

select cron.schedule(
  'cleanup-match-vod-cron-history',
  '27 3 * * *',
  $$
    delete from cron.job_run_details
    where jobid in (
      select jobid
      from cron.job
      where jobname in (
        'match-vod-automation-every-two-hours',
        'match-vod-automation-daily-backfill'
      )
    )
      and end_time < now() - interval '7 days'
  $$
);
