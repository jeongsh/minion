-- 신고·차단 발생 시 운영자에게 보내는 인앱 알림을 기존 community_notifications 알림함에 함께 저장한다.
-- 사용자 신고·차단은 글/댓글이 없을 수 있으므로 post_id/comment_id를 선택 값으로 바꾼다.
alter table public.community_notifications
  alter column post_id drop not null,
  alter column comment_id drop not null;

alter table public.community_notifications
  drop constraint community_notifications_kind_check;

alter table public.community_notifications
  add constraint community_notifications_kind_check
  check (kind in ('post_comment', 'comment_reply', 'admin_report', 'admin_block'));

-- 운영자 판정은 lib/auth/admin.ts의 isAdminUser와 같은 기준(app_metadata role/roles, ADMIN_EMAILS)을 쓴다.
-- auth.users는 Data API에 노출되지 않으므로 서비스 역할 전용 함수로만 조회한다.
create or replace function public.community_admin_user_ids(p_emails text[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.raw_app_meta_data ->> 'role' in ('admin', 'owner')
     or u.raw_app_meta_data ->> 'minion_role' in ('admin', 'owner')
     or coalesce(u.raw_app_meta_data -> 'roles', '[]'::jsonb) ?| array['admin', 'owner']
     or lower(u.email) = any (select lower(e) from unnest(coalesce(p_emails, '{}'::text[])) as e);
$$;

revoke all on function public.community_admin_user_ids(text[]) from public, anon, authenticated;
grant execute on function public.community_admin_user_ids(text[]) to service_role;

notify pgrst, 'reload schema';
