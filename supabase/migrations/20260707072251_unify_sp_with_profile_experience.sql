-- SP is the single spendable experience balance stored in profiles.lp.
set lock_timeout = '5s';
drop view if exists public.prediction_rankings;

create or replace function public.tier_for_sp(value bigint)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when value >= 320000 then 'grandmaster'
    when value >= 230000 then 'master'
    when value >= 160000 then 'diamond'
    when value >= 110000 then 'emerald'
    when value >= 70000 then 'platinum'
    when value >= 40000 then 'gold'
    when value >= 20000 then 'silver'
    when value >= 10000 then 'bronze'
    else 'iron'
  end;
$$;

-- Preserve any prediction gains/losses already made in the temporary wallet.
update public.profiles p
set lp = p.lp + w.balance
from public.prediction_wallets w
where w.user_id = p.id;

update public.profiles set tier = public.tier_for_sp(lp);
alter table public.profiles alter column lp set default 10000;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    split_part(new.email, '@', 1)
  );
  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := v_nickname || '_' || substr(new.id::text, 1, 6);
  end if;
  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 10000)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

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
begin
  if v_user_id is null then raise exception 'LOGIN_REQUIRED'; end if;
  if p_stake is null or p_stake < 100 then raise exception 'MIN_STAKE_100'; end if;
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;
  if v_match.match_date <= now() or v_match.status <> 'scheduled' then raise exception 'PREDICTION_CLOSED'; end if;
  if p_team_id <> v_match.team_a_id and p_team_id <> v_match.team_b_id then raise exception 'INVALID_TEAM'; end if;
  select * into v_profile from public.profiles where id = v_user_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_profile.lp < p_stake then raise exception 'INSUFFICIENT_SP'; end if;
  if exists (select 1 from public.prediction_bets where user_id = v_user_id and match_id = p_match_id) then
    raise exception 'BET_ALREADY_EXISTS';
  end if;
  update public.profiles
  set lp = profiles.lp - p_stake, tier = public.tier_for_sp(profiles.lp - p_stake)
  where id = v_user_id returning lp into v_balance;
  insert into public.prediction_bets (user_id, match_id, team_id, stake)
  values (v_user_id, p_match_id, p_team_id, p_stake) returning id into v_bet_id;
  insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
  values (v_user_id, v_bet_id, p_match_id, 'bet_placed', -p_stake, v_balance);
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
  update public.profiles
  set lp = profiles.lp + v_bet.stake, tier = public.tier_for_sp(profiles.lp + v_bet.stake)
  where id = v_user_id returning lp into v_balance;
  insert into public.prediction_wallet_ledger (user_id, match_id, reason, amount, balance_after)
  values (v_user_id, p_match_id, 'bet_cancelled', v_bet.stake, v_balance);
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

drop trigger if exists on_profile_created_prediction_wallet on public.profiles;
drop function if exists public.create_prediction_wallet_for_profile();
drop table public.prediction_wallets;

create or replace view public.ranked_profiles
with (security_invoker = on)
as
with gm as (
  select id, row_number() over (order by lp desc, created_at asc) as gm_rank
  from public.profiles where lp >= 320000
)
select
  p.id, p.nickname, p.lp, p.created_at, p.tier as base_tier,
  case when gm.gm_rank is not null and gm.gm_rank <= 50 then 'challenger' else p.tier end as effective_tier,
  rank() over (order by p.lp desc) as overall_rank
from public.profiles p left join gm on gm.id = p.id;

create view public.prediction_rankings
with (security_invoker = true)
as
select
  p.id as user_id, p.nickname, p.lp as balance, p.lp - 10000 as profit,
  count(b.id)::integer as bet_count,
  count(b.id) filter (where b.status = 'won')::integer as win_count,
  rank() over (order by p.lp desc, p.created_at asc) as rank
from public.profiles p
join public.prediction_bets b on b.user_id = p.id
group by p.id, p.nickname, p.created_at, p.lp;

grant select on public.ranked_profiles to anon, authenticated;
grant select on public.prediction_rankings to anon, authenticated;
