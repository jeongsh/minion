alter table public.lck_transfer_markets
  add column hidden_roster_tags text[] not null default '{}';

create function public.set_lck_transfer_roster_tag_visibility(
  target_season integer,
  tag_keys text[],
  show_tags boolean
) returns boolean
language sql
volatile
security invoker
set search_path = ''
as $$
  with updated as (
    update public.lck_transfer_markets
    set hidden_roster_tags = case
      when show_tags and tag_keys is null then '{}'::text[]
      when show_tags then array(
        select key from unnest(hidden_roster_tags) as key
        where key <> all(tag_keys)
      )
      else array(
        select distinct key from unnest(hidden_roster_tags || tag_keys) as key
        order by key
      )
    end
    where season = target_season
    returning 1
  )
  select exists (select 1 from updated);
$$;

revoke execute on function public.set_lck_transfer_roster_tag_visibility(integer, text[], boolean)
  from public, anon, authenticated;
grant execute on function public.set_lck_transfer_roster_tag_visibility(integer, text[], boolean)
  to service_role;
