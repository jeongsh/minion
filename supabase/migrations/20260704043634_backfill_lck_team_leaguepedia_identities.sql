with identities(slug, page_name) as (
  values
    ('t1', 'T1'),
    ('geng', 'Gen.G'),
    ('hle', 'Hanwha Life Esports'),
    ('dk', 'Dplus Kia'),
    ('kt', 'KT Rolster'),
    ('ns', 'Nongshim RedForce'),
    ('drx', 'Kiwoom DRX'),
    ('bro', 'HANJIN BRION'),
    ('fox', 'BNK FEARX'),
    ('soop', 'DN SOOPers')
)
update public.teams as team
set leaguepedia_page = identities.page_name,
    source_team_id = 'lp:' || identities.page_name
from identities
where team.slug = identities.slug;

with aliases(slug, page_name) as (
  values
    ('t1', 'T1'),
    ('geng', 'Gen.G'),
    ('hle', 'Hanwha Life Esports'),
    ('dk', 'Dplus Kia'),
    ('kt', 'KT Rolster'),
    ('ns', 'Nongshim RedForce'),
    ('drx', 'Kiwoom DRX'),
    ('drx', 'DRX'),
    ('bro', 'HANJIN BRION'),
    ('bro', 'BRION'),
    ('fox', 'BNK FEARX'),
    ('soop', 'DN SOOPers')
)
insert into public.leaguepedia_team_aliases (team_id, page_name)
select team.id, aliases.page_name
from aliases
join public.teams as team on team.slug = aliases.slug
on conflict (page_name) do nothing;
