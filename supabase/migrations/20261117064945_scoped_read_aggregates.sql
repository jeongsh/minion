CREATE OR REPLACE FUNCTION public.read_calendar_scope(p_team_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
with days as(select to_char(day,'MM-DD') md from generate_series(p_from::timestamp,least(p_to,p_from+62)::timestamp-interval '1 day',interval '1 day') day),
players as(select p.id from public.players p where p.is_lck_player and p.is_active is distinct from false
and (p_team_id is null or p.team_id=p_team_id) and to_char(p.birth_date,'MM-DD') in(select md from days)),
events as(select e.id from public.fan_calendar_events e where
(p_team_id is null or e.team_id=p_team_id or (e.team_id is null and exists(select 1 from public.players p where p.id=e.player_id and p.team_id=p_team_id)))
and ((e.is_recurring and to_char(e.event_date,'MM-DD') in(select md from days))
or (not e.is_recurring and e.event_date>=p_from and e.event_date<p_to)))
select jsonb_build_object('playerIds',coalesce((select jsonb_agg(id) from players),'[]'::jsonb),
'eventIds',coalesce((select jsonb_agg(id) from events),'[]'::jsonb))
$function$;
REVOKE ALL ON FUNCTION public.read_calendar_scope(p_team_id uuid, p_from date, p_to date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_calendar_scope(p_team_id uuid, p_from date, p_to date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.read_champion_games_page(p_champion_id uuid, p_set_ids uuid[], p_position text, p_page integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
with facts as (
select distinct on (s.set_id,s.player_id) s.set_id,s.player_id,m.match_date,g.set_number
from public.set_player_stats s join public.sets g on g.id=s.set_id left join public.matches m on m.id=g.match_id
where s.set_id=any(p_set_ids) and s.champion_id=p_champion_id and s.position=p_position
order by s.set_id,s.player_id,s.id
), total as (select count(*)::integer n from facts),
paging as (select n,greatest(1,least(greatest(1,coalesce(p_page,1)),greatest(1,(n+19)/20))) page from total),
selected as (select f.* from facts f order by f.match_date desc nulls last,f.set_number desc,f.set_id desc,f.player_id
limit 20 offset (select (page-1)*20 from paging))
select jsonb_build_object('total',n,'page',page,'pairs',coalesce((select jsonb_agg(jsonb_build_object('setId',set_id,'playerId',player_id) order by match_date desc nulls last,set_number desc,set_id desc,player_id) from selected),'[]'::jsonb))
from paging
$function$;
REVOKE ALL ON FUNCTION public.read_champion_games_page(p_champion_id uuid, p_set_ids uuid[], p_position text, p_page integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_champion_games_page(p_champion_id uuid, p_set_ids uuid[], p_position text, p_page integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.read_fan_totals(p_team_id uuid, p_since timestamp with time zone)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$ select jsonb_build_object('fanCount',(select count(distinct case when user_id is not null then 'u:'||user_id::text else 'v:'||coalesce(voter_key,'null') end) from public.team_fans where team_id=p_team_id),'heatCount',(select count(*) from public.fan_temperature_events where team_id=p_team_id and created_at>=p_since),'heatWeight',(select coalesce(sum(coalesce(weight,1)),0) from public.fan_temperature_events where team_id=p_team_id and created_at>=p_since)) $function$;
REVOKE ALL ON FUNCTION public.read_fan_totals(p_team_id uuid, p_since timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_fan_totals(p_team_id uuid, p_since timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.read_player_history_matches(p_player_id uuid, p_tournament_ids uuid[], p_after_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(match_id uuid, match_date timestamp with time zone)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
select m.id,m.match_date from public.matches m where m.tournament_id=any(p_tournament_ids)
and exists(select 1 from public.sets g join public.set_player_stats s on s.set_id=g.id
where g.match_id=m.id and g.winner_team_id is not null and s.player_id=p_player_id)
and (p_after_date is null or m.match_date<p_after_date or (m.match_date=p_after_date and m.id<p_after_id))
order by m.match_date desc,m.id desc limit least(50,greatest(1,p_limit))+1
$function$;
REVOKE ALL ON FUNCTION public.read_player_history_matches(p_player_id uuid, p_tournament_ids uuid[], p_after_date timestamp with time zone, p_after_id uuid, p_limit integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_player_history_matches(p_player_id uuid, p_tournament_ids uuid[], p_after_date timestamp with time zone, p_after_id uuid, p_limit integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.read_player_segment_context(p_set_ids uuid[], p_position text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
with lines as (select s.*,g.duration_seconds,((array_position(p_set_ids,s.set_id)-1)/100) chunk
from public.set_player_stats s join public.sets g on g.id=s.set_id where s.set_id=any(p_set_ids)),
benchmarks as (select player_id,position,
jsonb_build_object('setId','aggregate','playerId',player_id,'teamId',min(team_id::text),'position',position,'championId',null,
'kills',sum(kills),'deaths',sum(deaths),'assists',sum(assists),'cs',sum(cs),'gold',sum(gold),
'damageToChampions',sum(damage_to_champions),'visionScore',sum(vision_score),'visionScoreAverage',avg(vision_score),
'teamKills',0,'teamDamage',0,'gameMinutes',sum(coalesce(duration_seconds,0))/60.0,
'dpm',avg(dpm),'damageShare',avg(damage_share),'visionScorePerMinute',avg(vision_score_per_minute),'csPerMinute',avg(cs_per_minute),
'goldDiffAt10',avg(gold_diff_at_10),'xpDiffAt10',avg(xp_diff_at_10),'csDiffAt10',avg(cs_diff_at_10),
'goldDiffAt15',avg(gold_diff_at_15),'xpDiffAt15',avg(xp_diff_at_15),'csDiffAt15',avg(cs_diff_at_15),
'itemIds','[]'::jsonb,'spellIds','[]'::jsonb,'runeIds','[]'::jsonb,'roleBoundItem',null,'patch',null) val
from lines where position=p_position group by player_id,position),
drafts as(select champion_id,count(*) filter(where action_type='pick') picks,count(*) filter(where action_type='ban') bans
from public.set_picks_bans where set_id=any(p_set_ids) and champion_id is not null group by champion_id),
first_use as(select distinct on(champion_id,player_id) champion_id,player_id,chunk,position,set_id from lines
where champion_id is not null order by champion_id,player_id,chunk,position,set_id),
users as(select champion_id,jsonb_agg(player_id order by chunk,position,set_id,player_id) ids from first_use group by champion_id)
select jsonb_build_object('benchmarks',coalesce((select jsonb_agg(val order by player_id) from benchmarks),'[]'::jsonb),
'pickBanByChampion',coalesce((select jsonb_object_agg(champion_id,jsonb_build_object('pickCount',picks,'banCount',bans)) from drafts),'{}'::jsonb),
'mainUserIdsByChampion',coalesce((select jsonb_object_agg(champion_id,ids) from users),'{}'::jsonb))
$function$;
REVOKE ALL ON FUNCTION public.read_player_segment_context(p_set_ids uuid[], p_position text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_player_segment_context(p_set_ids uuid[], p_position text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.read_poll_tally(p_poll_id uuid, p_voter_key text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$ select jsonb_build_object('counts',coalesce((select jsonb_object_agg(option_id, votes) from (select option_id,count(*) votes from public.post_poll_votes where poll_id=p_poll_id group by option_id) x),'{}'::jsonb),'total',(select count(*) from public.post_poll_votes where poll_id=p_poll_id),'myOptionId',(select option_id from public.post_poll_votes where poll_id=p_poll_id and voter_key=p_voter_key limit 1)) $function$;
REVOKE ALL ON FUNCTION public.read_poll_tally(p_poll_id uuid, p_voter_key text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_poll_tally(p_poll_id uuid, p_voter_key text) TO service_role;

CREATE OR REPLACE FUNCTION public.read_prediction_markets(p_match_ids uuid[])
 RETURNS TABLE(match_id uuid, team_id uuid, status text, stake numeric)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$ select b.match_id,b.team_id,b.status,sum(b.stake)::numeric from public.prediction_bets b where b.match_id=any(p_match_ids) group by b.match_id,b.team_id,b.status $function$;
REVOKE ALL ON FUNCTION public.read_prediction_markets(p_match_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_prediction_markets(p_match_ids uuid[]) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.read_prediction_report_tournaments()
 RETURNS TABLE(id uuid, name text, season integer)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$ select distinct t.id,t.name,t.season from public.prediction_bets b join public.matches m on m.id=b.match_id join public.tournaments t on t.id=m.tournament_id where b.user_id=auth.uid() $function$;
REVOKE ALL ON FUNCTION public.read_prediction_report_tournaments() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_prediction_report_tournaments() TO authenticated;

CREATE OR REPLACE FUNCTION public.read_rating_reactions(p_rating_ids uuid[])
 RETURNS TABLE(rating_id uuid, honor_count bigint, dislike_count bigint)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
select r.rating_id,count(*) filter(where r.kind='honor'),count(*) filter(where r.kind='dislike')
from public.fan_rating_reactions r where r.rating_id=any(p_rating_ids) group by r.rating_id
$function$;
REVOKE ALL ON FUNCTION public.read_rating_reactions(p_rating_ids uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_rating_reactions(p_rating_ids uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.read_set_rating_summary(p_set_id uuid)
 RETURNS TABLE(player_id uuid, team_id uuid, rating_count bigint, rating_total numeric, latest_at timestamp with time zone, review_count bigint)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
select r.player_id,r.team_id,count(*),sum(r.rating),max(r.created_at),
count(*) filter(where r.blinded_at is null and btrim(coalesce(r.review,''))<>'')
from public.fan_ratings r where r.set_id=p_set_id group by r.player_id,r.team_id
order by min(r.created_at) desc, r.player_id
$function$;
REVOKE ALL ON FUNCTION public.read_set_rating_summary(p_set_id uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_set_rating_summary(p_set_id uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.read_signup_counts(p_since timestamp with time zone)
 RETURNS TABLE(signup_date text, signups bigint)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$ select to_char(created_at at time zone 'Asia/Seoul','YYYY-MM-DD'),count(*) from public.profiles where created_at>=p_since group by 1 order by 1 $function$;
REVOKE ALL ON FUNCTION public.read_signup_counts(p_since timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_signup_counts(p_since timestamp with time zone) TO service_role;

CREATE OR REPLACE FUNCTION public.search_match_ids(p_query text, p_tokens text[])
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 SECURITY INVOKER
 STABLE
 SET search_path TO ''
AS $function$
with candidates as (
select m.id,m.status,m.match_date, array(
select lower(regexp_replace(coalesce(field,''),'[[:space:]]','','g'))
from unnest(array[m.name,(to_jsonb(m.match_date)#>>'{}'),m.match_date::text,
to_char(m.match_date at time zone 'Asia/Seoul','FMMM')||'월 '||to_char(m.match_date at time zone 'Asia/Seoul','FMDD')||'일 '||
case when extract(hour from m.match_date at time zone 'Asia/Seoul')<12 then '오전 ' else '오후 ' end||
to_char(m.match_date at time zone 'Asia/Seoul','HH12:MI'),
a.name,a.short_name,a.slug,b.name,b.short_name,b.slug,t.name,t.category,t.split,t.league]
||coalesce(a.search_aliases,'{}'::text[])||coalesce(b.search_aliases,'{}'::text[])) as fields(field)
) as fields
from public.matches m left join public.teams a on a.id=m.team_a_id left join public.teams b on b.id=m.team_b_id
left join public.tournaments t on t.id=m.tournament_id
), matched as (
select c.* from candidates c where length(p_query)>=2 and (
exists(select 1 from unnest(c.fields) f where position(p_query in f)>0)
or (cardinality(p_tokens)>1 and not exists(select 1 from unnest(p_tokens) token where not exists(select 1 from unnest(c.fields) f where position(token in f)>0)))
))
select m.id from matched m order by case m.status when 'live' then 0 when 'scheduled' then 1 else 2 end,
case when m.status<>'completed' then m.match_date end asc,
case when m.status='completed' then m.match_date end desc,m.id
limit 6
$function$;
REVOKE ALL ON FUNCTION public.search_match_ids(p_query text, p_tokens text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_match_ids(p_query text, p_tokens text[]) TO anon, authenticated, service_role;
