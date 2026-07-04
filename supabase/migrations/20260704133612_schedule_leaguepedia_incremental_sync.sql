create or replace function private.invoke_leaguepedia_incremental_sync()
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
  select decrypted_secret
  into v_site_url
  from vault.decrypted_secrets
  where name = 'lckhub_automation_url';

  select decrypted_secret
  into v_cron_secret
  from vault.decrypted_secrets
  where name = 'lckhub_automation_secret';

  select decrypted_secret
  into v_vercel_bypass
  from vault.decrypted_secrets
  where name = 'lckhub_vercel_bypass';

  if nullif(v_site_url, '') is null
    or nullif(v_cron_secret, '') is null
    or nullif(v_vercel_bypass, '') is null then
    raise exception 'Leaguepedia incremental sync Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/leaguepedia-incremental',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'X-Vercel-Protection-Bypass', v_vercel_bypass,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 55000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_leaguepedia_incremental_sync()
  from public, anon, authenticated;

select cron.schedule(
  'leaguepedia-incremental-sync-daily',
  '30 20 * * *',
  'select private.invoke_leaguepedia_incremental_sync()'
);
