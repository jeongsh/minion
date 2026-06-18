update public.champions
set
  name = '말파이트',
  ddragon_id = 'Malphite'
where regexp_replace(
  lower(coalesce(ddragon_id, slug, name)),
  '[^a-z0-9]',
  '',
  'g'
) in ('malphite');
