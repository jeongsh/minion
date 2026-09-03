create or replace function public.create_community_comment(
  p_post_id uuid,
  p_content text,
  p_author_id uuid,
  p_guest_nickname text default null,
  p_guest_key text default null,
  p_guest_ip_key text default null,
  p_guest_ip_label text default null,
  p_parent_id uuid default null,
  p_content_kind text default 'text',
  p_minicon_item_id uuid default null,
  p_minicon_item_id_2 uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_comment_id uuid;
begin
  insert into public.community_comments (
    post_id,
    parent_id,
    content,
    content_kind,
    minicon_item_id,
    minicon_item_id_2,
    author_id,
    guest_nickname,
    guest_ip_label,
    guest_key
  ) values (
    p_post_id,
    p_parent_id,
    p_content,
    p_content_kind,
    p_minicon_item_id,
    p_minicon_item_id_2,
    p_author_id,
    p_guest_nickname,
    null,
    p_guest_key
  )
  returning id into v_comment_id;

  if p_guest_key is not null then
    insert into public.community_guest_comment_credentials (
      comment_id,
      guest_key,
      ip_key,
      ip_label
    ) values (
      v_comment_id,
      p_guest_key,
      p_guest_ip_key,
      p_guest_ip_label
    );
  end if;

  update public.community_posts
  set comment_count = comment_count + 1
  where id = p_post_id;

  return v_comment_id;
end;
$$;

revoke all on function public.create_community_comment(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, uuid
) from public, anon, authenticated;

grant execute on function public.create_community_comment(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, uuid
) to service_role;

comment on function public.create_community_comment(
  uuid, text, uuid, text, text, text, text, uuid, text, uuid, uuid
) is '댓글, 비회원 자격정보, 게시글 댓글 수를 한 트랜잭션에서 생성한다.';

notify pgrst, 'reload schema';
