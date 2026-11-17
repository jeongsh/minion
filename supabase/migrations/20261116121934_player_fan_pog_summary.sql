-- Return only the selected player's POG sets instead of transferring teammate ratings.
create or replace function public.get_player_fan_pog_set_ids(
  p_player_id uuid,
  p_set_ids uuid[]
)
returns table (set_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  with player_wins as (
    select s.id, s.winner_team_id
    from public.sets s
    join public.set_player_stats ps
      on ps.set_id = s.id
      and ps.player_id = p_player_id
      and ps.team_id = s.winner_team_id
    where s.id = any(p_set_ids)
  ), ranked as (
    select r.set_id, r.player_id,
      row_number() over (
        partition by r.set_id
        order by avg(r.rating) desc, count(*) desc, max(r.created_at) desc,
          (array_agg(r.id order by r.created_at desc, r.id desc))[1] desc
      ) as place
    from public.fan_ratings r
    join player_wins w on w.id = r.set_id and w.winner_team_id = r.team_id
    group by r.set_id, r.player_id
  )
  select r.set_id
  from ranked r
  where r.place = 1 and r.player_id = p_player_id
  order by r.set_id;
$$;

revoke all on function public.get_player_fan_pog_set_ids(uuid, uuid[]) from public;
grant execute on function public.get_player_fan_pog_set_ids(uuid, uuid[]) to anon, authenticated, service_role;
