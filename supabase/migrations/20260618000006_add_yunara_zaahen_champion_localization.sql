with champion_catalog(ddragon_id, korean_name, slug) as (
  values
    ('Yunara', '유나라', 'yunara'),
    ('Zaahen', '자헨', 'zaahen')
)
update public.champions as champions
set
  name = champion_catalog.korean_name,
  ddragon_id = champion_catalog.ddragon_id
from champion_catalog
where regexp_replace(
  lower(coalesce(champions.ddragon_id, champions.slug, champions.name)),
  '[^a-z0-9]',
  '',
  'g'
) in (
  regexp_replace(lower(champion_catalog.ddragon_id), '[^a-z0-9]', '', 'g'),
  regexp_replace(lower(champion_catalog.slug), '[^a-z0-9]', '', 'g')
);
