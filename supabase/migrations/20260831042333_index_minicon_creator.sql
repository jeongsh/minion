create index minicon_packs_creator_id_idx
  on public.minicon_packs(creator_id)
  where creator_id is not null;
