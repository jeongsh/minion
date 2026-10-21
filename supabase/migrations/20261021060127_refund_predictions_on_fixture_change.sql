set lock_timeout = '5s';

-- Keep canonical pages and record the names currently returned by MatchSchedule.
insert into public.leaguepedia_team_aliases (team_id, page_name)
select t.id, a.page_name
from (values ('agal', 'Anyone''s Legend'), ('mibrlos', 'LØS'), ('mibrlos', 'LOS')) a(slug, page_name)
join public.teams t on t.slug = a.slug
on conflict (page_name) do nothing;

-- Older deployed syncs also read source_team_id, but not the alias table.
-- Canonical identity remains available through leaguepedia_page and name.
update public.teams t set source_team_id = 'lp:' || a.page_name
from (values ('agal', 'Anyone''s Legend'), ('mibrlos', 'LØS')) a(slug, page_name)
where t.slug = a.slug;

-- Only a matches trigger can invoke this internal refund operation. It runs in
-- the same transaction as the draw change, before result settlement can run.
create function private.refund_predictions_on_fixture_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bet record;
  v_balance bigint;
  v_same_pair boolean;
begin
  v_same_pair := (
    (old.team_a_id is not distinct from new.team_a_id and old.team_b_id is not distinct from new.team_b_id)
    or (old.team_a_id is not distinct from new.team_b_id and old.team_b_id is not distinct from new.team_a_id)
  );
  -- A side swap or schedule-only edit preserves the prediction. A no-op update
  -- also repairs pre-existing invalid bets left behind by older syncs.
  if v_same_pair and not exists (
    select 1 from public.prediction_bets b
    where b.match_id = new.id and b.status = 'open'
      and not (b.team_id is not distinct from new.team_a_id or b.team_id is not distinct from new.team_b_id)
  ) then return new; end if;

  for v_bet in
    select b.* from public.prediction_bets b
    where b.match_id = new.id and b.status = 'open'
    order by b.user_id, b.id for update
  loop
    update public.profiles set lp = profiles.lp + v_bet.stake
    where id = v_bet.user_id returning lp into v_balance;
    -- Like cancellation, remove the active ticket so the user or automation can
    -- bet again. Both ledgers retain the refund; settled bets stay untouched.
    insert into public.prediction_wallet_ledger (user_id, match_id, reason, amount, balance_after)
    values (v_bet.user_id, new.id, 'bet_refunded', v_bet.stake, v_balance);
    insert into public.lp_ledger (user_id, reason, delta)
    values (v_bet.user_id, 'prediction_bet_refunded', v_bet.stake);
    delete from public.prediction_bets where id = v_bet.id;
  end loop;
  return new;
end;
$$;
revoke all on function private.refund_predictions_on_fixture_change() from public, anon, authenticated, service_role;

create trigger refund_predictions_before_fixture_change
before update of team_a_id, team_b_id on public.matches
for each row execute function private.refund_predictions_on_fixture_change();
