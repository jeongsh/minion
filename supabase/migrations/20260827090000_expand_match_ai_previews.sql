alter table public.match_ai_previews
  add column if not exists content jsonb not null default '{}'::jsonb,
  add column if not exists generation_phase text not null default 'legacy',
  add column if not exists research_model text,
  add column if not exists response_id text,
  add column if not exists research_response_id text,
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists cached_input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0,
  add column if not exists reasoning_tokens bigint not null default 0,
  add column if not exists total_tokens bigint not null default 0,
  add column if not exists web_search_calls smallint not null default 0,
  add column if not exists estimated_cost_usd numeric(12, 8),
  add column if not exists pricing_snapshot jsonb not null default '[]'::jsonb;

alter table public.match_ai_previews
  add constraint match_ai_previews_generation_phase_check
  check (generation_phase in ('legacy', 'story', 'final'));

create index if not exists match_ai_previews_generated_at_idx
  on public.match_ai_previews (generated_at desc);

comment on column public.match_ai_previews.content is
  'Versioned rich preview payload: narrative, attributed evaluation, win conditions, and live checkpoint.';
comment on column public.match_ai_previews.estimated_cost_usd is
  'Estimated OpenAI cost for the stored generation, using the pricing snapshot captured at generation time.';

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.invoke_match_preview_automation()
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
    raise exception 'Match preview automation Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/match-previews',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'X-Vercel-Protection-Bypass', v_vercel_bypass,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 290000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_match_preview_automation()
  from public, anon, authenticated;

-- Hourly checks are cheap: only matches entering the 24-hour or 2-hour phase call OpenAI.
select cron.schedule(
  'match-preview-automation-hourly',
  '15 * * * *',
  'select private.invoke_match_preview_automation()'
);

select cron.schedule(
  'cleanup-match-preview-cron-history',
  '37 3 * * *',
  $$
    delete from cron.job_run_details
    where jobid in (
      select jobid
      from cron.job
      where jobname in (
        'match-preview-automation-hourly',
        'cleanup-match-preview-cron-history'
      )
    )
      and end_time < now() - interval '7 days'
  $$
);
