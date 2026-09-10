create or replace function public.get_champion_directory_stats(p_set_ids uuid[])
returns table (
  champion_id uuid,
  total_sets bigint,
  eligible_sets bigint,
  draft_picks bigint,
  draft_bans bigint,
  record_picks bigint,
  record_games bigint,
  record_wins bigint,
  positions jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input_sets as (
    select distinct set_id
    from unnest(coalesce(p_set_ids, '{}'::uuid[])) as requested(set_id)
  ),
  valid_drafts as (
    select draft.set_id, draft.champion_id, draft.action_type
    from public.set_picks_bans as draft
    join input_sets as requested on requested.set_id = draft.set_id
    where draft.champion_id is not null
      and draft.side is not null
  ),
  complete_draft_sets as (
    select draft.set_id
    from valid_drafts as draft
    group by draft.set_id
    having count(*) filter (where draft.action_type = 'pick') = 10
       and count(*) filter (where draft.action_type = 'ban') = 10
  ),
  eligible as (
    select
      (select count(*)::bigint from input_sets) as total_count,
      (select count(*)::bigint from complete_draft_sets) as complete_count
  ),
  draft_totals as (
    select
      draft.champion_id,
      count(distinct draft.set_id) filter (where draft.action_type = 'pick')::bigint as picks,
      count(distinct draft.set_id) filter (where draft.action_type = 'ban')::bigint as bans
    from valid_drafts as draft
    join complete_draft_sets as complete on complete.set_id = draft.set_id
    group by draft.champion_id
  ),
  scoped_stats as (
    select
      stat.champion_id,
      stat.position,
      result.winner_team_id,
      stat.team_id
    from public.set_player_stats as stat
    join input_sets as requested on requested.set_id = stat.set_id
    join public.sets as result on result.id = stat.set_id
    where stat.champion_id is not null
  ),
  record_totals as (
    select
      stat.champion_id,
      count(*)::bigint as picks,
      count(*) filter (where stat.winner_team_id is not null)::bigint as games,
      count(*) filter (
        where stat.winner_team_id is not null
          and stat.winner_team_id = stat.team_id
      )::bigint as wins
    from scoped_stats as stat
    group by stat.champion_id
  ),
  position_totals as (
    select
      stat.champion_id,
      stat.position,
      count(*)::bigint as picks,
      count(*) filter (where stat.winner_team_id is not null)::bigint as games,
      count(*) filter (
        where stat.winner_team_id is not null
          and stat.winner_team_id = stat.team_id
      )::bigint as wins
    from scoped_stats as stat
    where stat.position in ('TOP', 'JGL', 'MID', 'BOT', 'SUP')
    group by stat.champion_id, stat.position
  ),
  position_json as (
    select
      totals.champion_id,
      jsonb_agg(
        jsonb_build_object(
          'position', totals.position,
          'picks', totals.picks,
          'games', totals.games,
          'wins', totals.wins
        )
        order by case totals.position
          when 'TOP' then 1
          when 'JGL' then 2
          when 'MID' then 3
          when 'BOT' then 4
          when 'SUP' then 5
          else 6
        end
      ) as positions
    from position_totals as totals
    group by totals.champion_id
  ),
  active_champions as (
    select champion_id from draft_totals
    union
    select champion_id from record_totals
  )
  select
    active.champion_id,
    eligible.total_count as total_sets,
    eligible.complete_count as eligible_sets,
    coalesce(draft.picks, 0)::bigint as draft_picks,
    coalesce(draft.bans, 0)::bigint as draft_bans,
    coalesce(record.picks, 0)::bigint as record_picks,
    coalesce(record.games, 0)::bigint as record_games,
    coalesce(record.wins, 0)::bigint as record_wins,
    coalesce(position.positions, '[]'::jsonb) as positions
  from active_champions as active
  cross join eligible
  left join draft_totals as draft using (champion_id)
  left join record_totals as record using (champion_id)
  left join position_json as position using (champion_id)
  order by active.champion_id;
$$;

comment on function public.get_champion_directory_stats(uuid[]) is
  'Returns compact public champion directory aggregates for the requested sets.';

revoke all on function public.get_champion_directory_stats(uuid[]) from public;
grant execute on function public.get_champion_directory_stats(uuid[]) to anon, authenticated, service_role;
