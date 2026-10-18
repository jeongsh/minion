set lock_timeout = '5s';

create table private.developer_prediction_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table private.developer_prediction_accounts enable row level security;
revoke all on private.developer_prediction_accounts from public, anon, authenticated;
grant select on private.developer_prediction_accounts to service_role;

-- Resolve once so a later nickname change cannot transfer automation to another user.
insert into private.developer_prediction_accounts (user_id)
select id from public.profiles where nickname in ('장로', '제우스', 'chovyyyy');
do $$ begin
  if (select count(*) from private.developer_prediction_accounts) <> 3 then
    raise exception 'Expected exactly three developer prediction accounts';
  end if;
end $$;

create or replace function public.run_developer_predictions(p_secret text, p_rankings jsonb default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_user record;
  v_score_a numeric;
  v_score_b numeric;
  v_probability numeric;
  v_team_id uuid;
  v_max_stake bigint;
  v_stake bigint;
  v_placed integer := 0;
  v_existing integer := 0;
  v_insufficient integer := 0;
  v_unranked integer := 0;
  v_original_sub text := current_setting('request.jwt.claim.sub', true);
begin
  if p_secret is null or not exists (
    select 1 from vault.decrypted_secrets
    where name = 'lckhub_automation_secret' and decrypted_secret = p_secret
  ) then
    raise exception 'AUTOMATION_UNAUTHORIZED';
  end if;
  -- The Edge Function checks authentication before fetching the official GPR page.
  if p_rankings is null then return jsonb_build_object('authorized', true); end if;
  if jsonb_typeof(p_rankings) <> 'array' then raise exception 'INVALID_GPR_DATA'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_rankings) as r(team_id uuid, score numeric, calculated_at timestamptz)
    where r.team_id is null or r.score is null or r.score <= 0 or r.score > 10000
      or r.calculated_at is null or r.calculated_at < now() - interval '14 days'
      or r.calculated_at > now() + interval '1 day'
  ) or exists (
    select 1 from jsonb_to_recordset(p_rankings) as r(team_id uuid)
    group by r.team_id having count(*) > 1
  ) then raise exception 'INVALID_GPR_DATA'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('developer-predictions', 0)) then
    return jsonb_build_object('busy', true);
  end if;

  -- Run repeatedly to pick up late schedules, but only bet on today's KST matches.
  for v_match in
    select m.* from public.matches m
    where m.status = 'scheduled' and m.match_date > clock_timestamp()
      and m.match_date < ((now() at time zone 'Asia/Seoul')::date + 1)::timestamp at time zone 'Asia/Seoul'
      and m.team_a_id is not null and m.team_b_id is not null and m.team_a_id <> m.team_b_id
    order by m.match_date, m.id for update of m
  loop
    select r.score into v_score_a from jsonb_to_recordset(p_rankings) as r(team_id uuid, score numeric)
    where r.team_id = v_match.team_a_id;
    select r.score into v_score_b from jsonb_to_recordset(p_rankings) as r(team_id uuid, score numeric)
    where r.team_id = v_match.team_b_id;
    if v_score_a is null or v_score_b is null then
      v_unranked := v_unranked + 1;
      continue;
    end if;
    v_probability := 1 / (1 + power(10::numeric, (v_score_b - v_score_a) / 400));
    for v_user in
      select p.id, p.lp from public.profiles p
      join private.developer_prediction_accounts a on a.user_id = p.id
      order by p.id for update of p
    loop
      if exists (select 1 from public.prediction_bets b where b.user_id = v_user.id and b.match_id = v_match.id) then
        v_existing := v_existing + 1;
        continue;
      end if;
      if v_user.lp < 100 then
        v_insufficient := v_insufficient + 1;
        continue;
      end if;
      if v_match.match_date <= clock_timestamp() then continue; end if;
      -- Same cap as place_prediction_bet: 20% of LP rounded down, minimum 100, cap 5000.
      v_max_stake := least(5000, greatest(100, floor(v_user.lp::numeric * 0.2 / 100) * 100));
      v_stake := (1 + floor(random() * (v_max_stake / 100)))::bigint * 100;
      v_team_id := case when random() < v_probability then v_match.team_a_id else v_match.team_b_id end;
      perform set_config('request.jwt.claim.sub', v_user.id::text, true);
      perform public.place_prediction_bet(v_match.id, v_team_id, v_stake);
      v_placed := v_placed + 1;
    end loop;
  end loop;
  perform set_config('request.jwt.claim.sub', coalesce(v_original_sub, ''), true);
  return jsonb_build_object('placed', v_placed, 'existing', v_existing,
    'insufficientLp', v_insufficient, 'unrankedMatches', v_unranked);
end;
$$;
revoke all on function public.run_developer_predictions(text, jsonb) from public, anon, authenticated;
grant execute on function public.run_developer_predictions(text, jsonb) to service_role;

-- The endpoint URL is configured in Vault at deployment, without embedding credentials.
select cron.schedule(
  'developer-predictions-every-fifteen-minutes', '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'developer_prediction_function_url'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lckhub_automation_secret')),
      body := '{}'::jsonb, timeout_milliseconds := 60000
    );
  $cron$
);
select cron.schedule(
  'cleanup-developer-prediction-cron-history', '47 3 * * *',
  $cron$
    delete from cron.job_run_details where jobid in (
      select jobid from cron.job where jobname = 'developer-predictions-every-fifteen-minutes'
    ) and end_time < now() - interval '7 days';
  $cron$
);
