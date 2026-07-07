set lock_timeout = '5s';

with open_stakes as (
  select user_id, sum(stake)::bigint as reserved_lp
  from public.prediction_bets
  where status = 'open'
  group by user_id
)
update public.profiles p
set tier = public.tier_for_sp(p.lp + coalesce(s.reserved_lp, 0))
from open_stakes s
where s.user_id = p.id;
