drop policy "read available minicon items" on public.minicon_items;
drop policy "read available minicon packs" on public.minicon_packs;

create policy "public read published minicon packs"
  on public.minicon_packs for select
  to anon, authenticated
  using (status = 'published');

create policy "public read published minicon items"
  on public.minicon_items for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.minicon_packs pack
      where pack.id = minicon_items.pack_id
        and pack.status = 'published'
    )
  );

drop function public.can_read_minicon_pack(uuid);

comment on policy "public read published minicon packs" on public.minicon_packs is
  '신청 내역은 서버에서 소유자를 검증해 조회하고 Data API에는 공개 완료된 패키지만 노출한다.';
