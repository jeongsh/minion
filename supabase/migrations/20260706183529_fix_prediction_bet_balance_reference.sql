create or replace function public.place_prediction_bet(p_match_id uuid, p_team_id uuid, p_stake bigint)
returns table (bet_id uuid, balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_wallet public.prediction_wallets%rowtype;
  v_bet_id uuid;
  v_balance bigint;
begin
  if v_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_stake is null or p_stake < 100 then raise exception 'MIN_STAKE_100'; end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_match.match_date <= now() or v_match.status <> 'scheduled' then raise exception 'PREDICTION_CLOSED'; end if;
  if p_team_id <> v_match.team_a_id and p_team_id <> v_match.team_b_id then raise exception 'INVALID_TEAM'; end if;

  insert into public.prediction_wallets (user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select * into v_wallet from public.prediction_wallets where user_id = v_user_id for update;
  if v_wallet.balance < p_stake then raise exception 'INSUFFICIENT_SP'; end if;
  if exists (select 1 from public.prediction_bets where user_id = v_user_id and match_id = p_match_id) then
    raise exception 'BET_ALREADY_EXISTS';
  end if;

  update public.prediction_wallets
  set balance = prediction_wallets.balance - p_stake, updated_at = now()
  where user_id = v_user_id
  returning prediction_wallets.balance into v_balance;

  insert into public.prediction_bets (user_id, match_id, team_id, stake)
  values (v_user_id, p_match_id, p_team_id, p_stake)
  returning id into v_bet_id;

  insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
  values (v_user_id, v_bet_id, p_match_id, 'bet_placed', -p_stake, v_balance);

  return query select v_bet_id, v_balance;
end;
$$;

revoke all on function public.place_prediction_bet(uuid, uuid, bigint) from public, anon;
grant execute on function public.place_prediction_bet(uuid, uuid, bigint) to authenticated;
