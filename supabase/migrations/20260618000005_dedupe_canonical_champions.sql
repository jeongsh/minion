with champion_dedupe(from_slug, to_slug) as (
  values
    ('renata-glasc', 'renata'),
    ('wukong', 'monkey-king')
),
champion_pairs as (
  select
    from_champion.id as from_id,
    to_champion.id as to_id
  from champion_dedupe
  join public.champions as from_champion on from_champion.slug = champion_dedupe.from_slug
  join public.champions as to_champion on to_champion.slug = champion_dedupe.to_slug
)
update public.set_picks_bans
set champion_id = champion_pairs.to_id
from champion_pairs
where champion_id = champion_pairs.from_id;

with champion_dedupe(from_slug, to_slug) as (
  values
    ('renata-glasc', 'renata'),
    ('wukong', 'monkey-king')
),
champion_pairs as (
  select
    from_champion.id as from_id,
    to_champion.id as to_id
  from champion_dedupe
  join public.champions as from_champion on from_champion.slug = champion_dedupe.from_slug
  join public.champions as to_champion on to_champion.slug = champion_dedupe.to_slug
)
update public.set_player_stats
set champion_id = champion_pairs.to_id
from champion_pairs
where champion_id = champion_pairs.from_id;

with champion_dedupe(from_slug, to_slug) as (
  values
    ('renata-glasc', 'renata'),
    ('wukong', 'monkey-king')
),
champion_pairs as (
  select
    from_champion.id as from_id,
    to_champion.id as to_id
  from champion_dedupe
  join public.champions as from_champion on from_champion.slug = champion_dedupe.from_slug
  join public.champions as to_champion on to_champion.slug = champion_dedupe.to_slug
)
update public.soloq_matches
set champion_id = champion_pairs.to_id
from champion_pairs
where champion_id = champion_pairs.from_id;

with champion_dedupe(from_slug, to_slug) as (
  values
    ('renata-glasc', 'renata'),
    ('wukong', 'monkey-king')
),
champion_pairs as (
  select
    from_champion.id as from_id,
    to_champion.id as to_id
  from champion_dedupe
  join public.champions as from_champion on from_champion.slug = champion_dedupe.from_slug
  join public.champions as to_champion on to_champion.slug = champion_dedupe.to_slug
)
update public.community_posts
set champion_id = champion_pairs.to_id
from champion_pairs
where champion_id = champion_pairs.from_id;

with champion_dedupe(from_slug, to_slug) as (
  values
    ('renata-glasc', 'renata'),
    ('wukong', 'monkey-king')
),
champion_pairs as (
  select
    from_champion.id as from_id,
    to_champion.id as to_id
  from champion_dedupe
  join public.champions as from_champion on from_champion.slug = champion_dedupe.from_slug
  join public.champions as to_champion on to_champion.slug = champion_dedupe.to_slug
)
update public.champion_stats_pro
set champion_id = champion_pairs.to_id
from champion_pairs
where champion_id = champion_pairs.from_id;

delete from public.champions
where slug in ('renata-glasc', 'wukong');
