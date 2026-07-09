-- 승부예측 베팅으로 인한 LP 증감이 lp_ledger(=/me 페이지 "최근 LP 변동")에도 기록되도록 함.
-- 지금까지는 prediction_wallet_ledger 에만 남고 lp_ledger 에는 안 남아서,
-- profiles.lp 는 실제로 바뀌는데 /me 페이지 최근 LP 변동 목록에는 왜 바뀌었는지 전혀 안 보였다.
set lock_timeout = '5s';

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
  v_max_stake := least(5000, floor(v_profile.lp::numeric * 0.2 / 100) * 100)::bigint;
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
  insert into public.lp_ledger (user_id, reason, delta)
  values (v_user_id, 'prediction_bet_placed', -p_stake);
  return query select v_bet_id, v_balance;
end;
$$;

create or replace function public.cancel_prediction_bet(p_match_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.prediction_bets%rowtype;
  v_match_date timestamptz;
  v_balance bigint;
begin
  if v_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select b.* into v_bet from public.prediction_bets b
  where b.user_id = v_user_id and b.match_id = p_match_id and b.status = 'open' for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  select match_date into v_match_date from public.matches where id = p_match_id;
  if v_match_date <= now() then raise exception 'PREDICTION_CLOSED'; end if;
  delete from public.prediction_bets where id = v_bet.id;
  update public.profiles set lp = profiles.lp + v_bet.stake
  where id = v_user_id returning lp into v_balance;
  insert into public.prediction_wallet_ledger (user_id, match_id, reason, amount, balance_after)
  values (v_user_id, p_match_id, 'bet_cancelled', v_bet.stake, v_balance);
  insert into public.lp_ledger (user_id, reason, delta)
  values (v_user_id, 'prediction_bet_cancelled', v_bet.stake);
  return v_balance;
end;
$$;

create or replace function public.settle_prediction_bets_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_winner_total bigint;
  v_bet record;
  v_payout bigint;
  v_balance bigint;
begin
  if new.status <> 'completed' or new.winner_team_id is null then return new; end if;
  if old.status = 'completed' and old.winner_team_id is not distinct from new.winner_team_id then return new; end if;
  select coalesce(sum(stake), 0), coalesce(sum(stake) filter (where team_id = new.winner_team_id), 0)
  into v_total, v_winner_total from public.prediction_bets where match_id = new.id and status = 'open';
  if v_total = 0 then return new; end if;
  if v_winner_total = 0 then
    for v_bet in select * from public.prediction_bets where match_id = new.id and status = 'open' loop
      update public.profiles set lp = profiles.lp + v_bet.stake, tier = public.tier_for_sp(profiles.lp + v_bet.stake)
      where id = v_bet.user_id returning lp into v_balance;
      update public.prediction_bets set status = 'refunded', payout = v_bet.stake, settled_at = now() where id = v_bet.id;
      insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
      values (v_bet.user_id, v_bet.id, new.id, 'bet_refunded', v_bet.stake, v_balance);
      insert into public.lp_ledger (user_id, reason, delta)
      values (v_bet.user_id, 'prediction_bet_refunded', v_bet.stake);
    end loop;
    return new;
  end if;
  for v_bet in select * from public.prediction_bets where match_id = new.id and status = 'open' loop
    if v_bet.team_id = new.winner_team_id then
      v_payout := floor(v_bet.stake::numeric * v_total::numeric / v_winner_total::numeric);
      update public.profiles set lp = profiles.lp + v_payout, tier = public.tier_for_sp(profiles.lp + v_payout)
      where id = v_bet.user_id returning lp into v_balance;
      update public.prediction_bets set status = 'won', payout = v_payout, settled_at = now() where id = v_bet.id;
      insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
      values (v_bet.user_id, v_bet.id, new.id, 'bet_won', v_payout, v_balance);
      insert into public.lp_ledger (user_id, reason, delta)
      values (v_bet.user_id, 'prediction_bet_won', v_payout);
    else
      update public.prediction_bets set status = 'lost', payout = 0, settled_at = now() where id = v_bet.id;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.place_prediction_bet(uuid, uuid, bigint) from public, anon;
revoke all on function public.cancel_prediction_bet(uuid) from public, anon;
grant execute on function public.place_prediction_bet(uuid, uuid, bigint) to authenticated;
grant execute on function public.cancel_prediction_bet(uuid) to authenticated;
revoke all on function public.settle_prediction_bets_for_match() from public, anon, authenticated;
