-- Compare the prior events atomically without putting the JSON document in the request URL.
create function public.replace_lck_transfer_manual_events(
  target_season integer,
  expected_events jsonb,
  replacement_events jsonb
) returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  with updated as (
    update public.lck_transfer_markets
    set manual_events = replacement_events
    where season = target_season
      and manual_events = expected_events
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke execute on function public.replace_lck_transfer_manual_events(integer, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_lck_transfer_manual_events(integer, jsonb, jsonb)
  to service_role;
