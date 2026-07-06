-- Free, non-cash prediction points. One wallet and at most one open bet per user/match.
create table public.prediction_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance bigint not null default 10000 check (balance >= 0),
  initial_grant bigint not null default 10000 check (initial_grant > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prediction_bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  stake bigint not null check (stake > 0),
  status text not null default 'open' check (status in ('open', 'won', 'lost', 'refunded')),
  payout bigint not null default 0 check (payout >= 0),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, match_id)
);

create index prediction_bets_match_id_idx on public.prediction_bets(match_id);
create index prediction_bets_user_id_idx on public.prediction_bets(user_id);
create index prediction_bets_status_idx on public.prediction_bets(status);

create table public.prediction_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet_id uuid references public.prediction_bets(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  reason text not null check (reason in ('initial_grant', 'bet_placed', 'bet_cancelled', 'bet_won', 'bet_refunded')),
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

create index prediction_wallet_ledger_user_id_idx on public.prediction_wallet_ledger(user_id, created_at desc);

alter table public.prediction_wallets enable row level security;
alter table public.prediction_bets enable row level security;
alter table public.prediction_wallet_ledger enable row level security;

create policy "public read prediction wallets" on public.prediction_wallets for select using (true);
create policy "public read prediction bets" on public.prediction_bets for select using (true);
create policy "users read own prediction ledger" on public.prediction_wallet_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.prediction_wallets to anon, authenticated;
grant select on public.prediction_bets to anon, authenticated;
grant select on public.prediction_wallet_ledger to authenticated;

insert into public.prediction_wallets (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

insert into public.prediction_wallet_ledger (user_id, reason, amount, balance_after)
select user_id, 'initial_grant', initial_grant, balance
from public.prediction_wallets
on conflict do nothing;

create or replace function public.create_prediction_wallet_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.prediction_wallets (user_id) values (new.id)
  on conflict (user_id) do nothing;
  insert into public.prediction_wallet_ledger (user_id, reason, amount, balance_after)
  values (new.id, 'initial_grant', 10000, 10000);
  return new;
end;
$$;

create trigger on_profile_created_prediction_wallet
after insert on public.profiles
for each row execute function public.create_prediction_wallet_for_profile();

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
  select b.* into v_bet
  from public.prediction_bets b
  where b.user_id = v_user_id and b.match_id = p_match_id and b.status = 'open'
  for update;
  if not found then raise exception 'BET_NOT_FOUND'; end if;
  select match_date into v_match_date from public.matches where id = p_match_id;
  if v_match_date <= now() then raise exception 'PREDICTION_CLOSED'; end if;

  delete from public.prediction_bets where id = v_bet.id;
  update public.prediction_wallets
  set balance = balance + v_bet.stake, updated_at = now()
  where user_id = v_user_id
  returning balance into v_balance;
  insert into public.prediction_wallet_ledger (user_id, match_id, reason, amount, balance_after)
  values (v_user_id, p_match_id, 'bet_cancelled', v_bet.stake, v_balance);
  return v_balance;
end;
$$;

revoke all on function public.place_prediction_bet(uuid, uuid, bigint) from public, anon;
revoke all on function public.cancel_prediction_bet(uuid) from public, anon;
grant execute on function public.place_prediction_bet(uuid, uuid, bigint) to authenticated;
grant execute on function public.cancel_prediction_bet(uuid) to authenticated;

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
  into v_total, v_winner_total
  from public.prediction_bets where match_id = new.id and status = 'open';

  if v_total = 0 then return new; end if;
  if v_winner_total = 0 then
    for v_bet in select * from public.prediction_bets where match_id = new.id and status = 'open' loop
      update public.prediction_wallets set balance = balance + v_bet.stake, updated_at = now()
      where user_id = v_bet.user_id returning balance into v_balance;
      update public.prediction_bets set status = 'refunded', payout = v_bet.stake, settled_at = now() where id = v_bet.id;
      insert into public.prediction_wallet_ledger (user_id, bet_id, match_id, reason, amount, balance_after)
      values (v_bet.user_id, v_bet.id, new.id, 'bet_refunded', v_bet.stake, v_balance);
    end loop;
    return new;
  end if;

  for v_bet in select * from public.prediction_bets where match_id = new.id and status = 'open' loop
    if v_bet.team_id = new.winner_team_id then
      v_payout := floor(v_bet.stake::numeric * v_total::numeric / v_winner_total::numeric);
      update public.prediction_wallets set balance = balance + v_payout, updated_at = now()
      where user_id = v_bet.user_id returning balance into v_balance;
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

revoke all on function public.settle_prediction_bets_for_match() from public, anon, authenticated;

create trigger settle_prediction_bets_after_match_result
after update of status, winner_team_id on public.matches
for each row execute function public.settle_prediction_bets_for_match();

create view public.prediction_rankings
with (security_invoker = true)
as
select
  p.id as user_id,
  p.nickname,
  w.balance,
  w.balance - w.initial_grant as profit,
  count(b.id)::integer as bet_count,
  count(b.id) filter (where b.status = 'won')::integer as win_count,
  rank() over (order by w.balance desc, p.created_at asc) as rank
from public.profiles p
join public.prediction_wallets w on w.user_id = p.id
join public.prediction_bets b on b.user_id = p.id
group by p.id, p.nickname, p.created_at, w.balance, w.initial_grant;

grant select on public.prediction_rankings to anon, authenticated;
