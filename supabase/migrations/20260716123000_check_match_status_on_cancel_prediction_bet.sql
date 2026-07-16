-- cancel_prediction_bet이 place_prediction_bet과 달리 매치 status는 안 보고 match_date만
-- 확인하고 있었다. match_date는 아직 안 지났는데 status가 이미 scheduled가 아닌 경우
-- (경기가 실제로 시작/진행 중인데 match_date 필드 갱신이 늦은 경우 등, 이번 세션에서
-- 프런트 예측 마감 판단 쪽에서 실제로 발견된 것과 같은 유형의 어긋남)에는 이미 시작한
-- 경기의 예측을 취소하고 환불받을 수 있었다. place_prediction_bet과 동일한 기준으로 통일한다.
set lock_timeout = '5s';

create or replace function public.cancel_prediction_bet(p_match_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.prediction_bets%rowtype;
  v_match public.matches%rowtype;
  v_balance bigint;
begin
  if v_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  select b.* into v_bet from public.prediction_bets b
  where b.user_id = v_user_id and b.match_id = p_match_id and b.status = 'open' for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  select * into v_match from public.matches where id = p_match_id;
  if v_match.match_date <= now() or v_match.status <> 'scheduled' then raise exception 'PREDICTION_CLOSED'; end if;
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

revoke all on function public.cancel_prediction_bet(uuid) from public, anon;
grant execute on function public.cancel_prediction_bet(uuid) to authenticated;
