drop policy "public read published minicon packs" on public.minicon_packs;
drop policy "creators read own minicon packs" on public.minicon_packs;

create policy "read available minicon packs"
  on public.minicon_packs for select
  to anon, authenticated
  using (
    status = 'published'
    or (
      (select auth.uid()) is not null
      and (select auth.uid()) = creator_id
    )
  );

drop policy "public read published minicon items" on public.minicon_items;
drop policy "creators read own minicon items" on public.minicon_items;

create policy "read available minicon items"
  on public.minicon_items for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.minicon_packs pack
      where pack.id = minicon_items.pack_id
        and (
          pack.status = 'published'
          or (
            (select auth.uid()) is not null
            and (select auth.uid()) = pack.creator_id
          )
        )
    )
  );
