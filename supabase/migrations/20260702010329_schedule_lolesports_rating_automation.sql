create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_lolesports_rating_automation()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site_url text;
  v_cron_secret text;
  v_request_id bigint;
begin
  select decrypted_secret
  into v_site_url
  from vault.decrypted_secrets
  where name = 'lckhub_automation_url';

  select decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets
  where name = 'lckhub_automation_secret';

  if nullif(v_site_url, '') is null or nullif(v_cron_secret, '') is null then
    raise exception 'LoL Esports automation Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/lolesports-ratings',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 25000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_lolesports_rating_automation()
  from public, anon, authenticated;

select cron.schedule(
  'lolesports-rating-automation-every-minute',
  '* * * * *',
  'select private.invoke_lolesports_rating_automation()'
);

select cron.schedule(
  'cleanup-lolesports-rating-cron-history',
  '17 3 * * *',
  $$
    delete from cron.job_run_details
    where jobid = (
      select jobid
      from cron.job
      where jobname = 'lolesports-rating-automation-every-minute'
    )
      and end_time < now() - interval '7 days'
  $$
);
