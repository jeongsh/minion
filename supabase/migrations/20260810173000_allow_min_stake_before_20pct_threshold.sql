set lock_timeout = '5s';

-- 기존에는 최대 베팅액이 "보유 LP의 20%"라서, 보유 LP가 500 미만이면
-- 최소 참여 금액(100)조차 걸 수 없었다(500 LP 모이려면 출석체크 100LP/일 기준 5일).
-- 최소 참여 금액 100은 20% 계산 결과와 무관하게 항상 허용한다.
create or replace function public.place_prediction_bet(p_match_id uuid, p_team_id uuid, p_stake bigint)
returns table (bet_id uuid, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_profile public.profiles%rowtype;
  v_bet_id uuid;
  v_balance bigint;
  v_max_stake bigint;
begin
  if v_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_stake is null or p_stake < 100 then raise exception 'MIN_STAKE_100'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_match.match_date <= now() or v_match.status <> 'scheduled' then raise exception 'PREDICTION_CLOSED'; end if;
  if p_team_id <> v_match.team_a_id and p_team_id <> v_match.team_b_id then raise exception 'INVALID_TEAM'; end if;
  select * into v_profile from public.profiles where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  v_max_stake := least(5000, greatest(100, floor(v_profile.lp::numeric * 0.2 / 100) * 100))::bigint;
  if p_stake > v_max_stake then raise exception 'MAX_STAKE_EXCEEDED:%', v_max_stake; end if;
  if v_profile.lp < p_stake then raise exception 'INSUFFICIENT_SP'; end if;
  if exists (select 1 from public.prediction_bets where user_id = v_user_id and match_id = p_match_id) then raise exception 'BET_ALREADY_EXISTS'; end if;
  -- Open stakes reduce spendable LP, but tier changes only when the match settles.
  update public.profiles set lp = profiles.lp - p_stake
  where id = v_user_id returning lp into v_balance;
  insert into public.prediction_bets (user_id, match_id, team_id, stake)
  values (v_user_id, p_match_id, p_team_id, p_stake) returning id into v_bet_id;
  insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
  values (v_user_id, v_bet_id, p_match_id, 'bet_placed', -p_stake, v_balance);
  return query select v_bet_id, v_balance;
end;
$$;
