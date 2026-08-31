alter table public.community_comments
  add column minicon_item_id_2 uuid references public.minicon_items(id) on delete restrict;

alter table public.community_comments
  drop constraint community_comments_minicon_shape_check,
  add constraint community_comments_minicon_shape_check
    check (
      (content_kind = 'text' and minicon_item_id is null and minicon_item_id_2 is null)
      or
      (
        content_kind = 'minicon'
        and minicon_item_id is not null
        and content = '[미니콘]'
      )
    );

create index community_comments_minicon_item_2_idx
  on public.community_comments(minicon_item_id_2)
  where minicon_item_id_2 is not null;

drop policy if exists "authenticated insert community comments" on public.community_comments;
create policy "authenticated insert community comments"
  on public.community_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and minicon_item_id is null
    and minicon_item_id_2 is null
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "authors update community comments" on public.community_comments;
create policy "authors update community comments"
  on public.community_comments for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and not (select private.current_user_is_community_sanctioned())
  )
  with check (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and minicon_item_id is null
    and minicon_item_id_2 is null
    and not (select private.current_user_is_community_sanctioned())
  );

comment on column public.community_comments.minicon_item_id_2 is
  '더블 미니콘 댓글의 오른쪽 아이템. 단일 미니콘은 null';
