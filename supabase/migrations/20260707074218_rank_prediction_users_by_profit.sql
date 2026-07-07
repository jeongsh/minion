set lock_timeout = '5s';

drop view if exists public.prediction_rankings;

create view public.prediction_rankings
with (security_invoker = true)
as
with prediction_results as (
  select
    b.user_id,
    count(*)::integer as bet_count,
    count(*) filter (where b.status = 'won')::integer as win_count,
    coalesce(sum(
      case
        when b.status in ('won', 'lost') then coalesce(b.payout, 0) - b.stake
        else 0
      end
    ), 0)::bigint as profit
  from public.prediction_bets b
  group by b.user_id
)
select
  p.id as user_id,
  p.nickname,
  p.lp as balance,
  r.profit,
  r.bet_count,
  r.win_count,
  rank() over (order by r.profit desc) as rank
from public.profiles p
join prediction_results r on r.user_id = p.id;

grant select on public.prediction_rankings to anon, authenticated;
