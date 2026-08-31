create or replace function public.can_read_minicon_pack(p_pack_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.minicon_packs pack
    where pack.id = p_pack_id
      and (
        pack.status = 'published'
        or (
          (select auth.uid()) is not null
          and pack.creator_id = (select auth.uid())
        )
      )
  );
$$;

revoke all on function public.can_read_minicon_pack(uuid)
  from public, anon, authenticated;
grant execute on function public.can_read_minicon_pack(uuid)
  to anon, authenticated;

drop policy "read available minicon items" on public.minicon_items;

create policy "read available minicon items"
  on public.minicon_items for select
  to anon, authenticated
  using (
    is_active
    and public.can_read_minicon_pack(pack_id)
  );

comment on function public.can_read_minicon_pack(uuid) is
  '민감한 패키지 열을 노출하지 않고 미니콘 아이템 RLS에서 공개·소유 여부만 확인한다.';
