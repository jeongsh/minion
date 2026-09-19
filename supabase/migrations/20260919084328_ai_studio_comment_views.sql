-- Count one post view per successful AI comment, including direct admin AI comments.
CREATE OR REPLACE FUNCTION public.community_ai_studio_capture_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target uuid;
begin
 if public.community_ai_studio_is_author(new.author_id,new.guest_key) then
   if tg_table_name='community_comments' then
     update public.community_posts set view_count=coalesce(view_count,0)+1 where id=new.post_id;
   end if;
   return new;
 end if;
 if new.deleted_at is not null or new.blinded_at is not null then return new; end if;
 if tg_table_name='community_comments' then
   target:=new.post_id;
   -- Row lock serializes organic activity against the queue worker for this post.
   update public.community_ai_studio_campaigns set state='paused',updated_at=now() where post_id=target and state='active';
   update public.community_ai_studio_queue set status='paused',error='실제 유저 참여로 검토 대기' where post_id=target and status='scheduled';
 else target:=new.id;
 end if;
 if exists(select 1 from public.community_ai_studio_settings where singleton and watch_enabled) then
   insert into public.community_ai_studio_inbox(post_id,comment_id,event_type)
   values(target,case when tg_table_name='community_comments' then new.id else null end,case when tg_table_name='community_comments' then 'comment' else 'post' end)
   on conflict(post_id) do update set context_hash=null,
     status=case when community_ai_studio_inbox.status='drafted' then 'pending' else community_ai_studio_inbox.status end,
     response_text=case when community_ai_studio_inbox.status in ('pending','drafted') then null else community_ai_studio_inbox.response_text end;
 end if;
 return new;
end $function$
;

-- One-time credit for AI comments created before this migration.
update public.community_posts p set view_count=coalesce(p.view_count,0)+a.total
from (
 select post_id,count(*)::integer as total from public.community_comments
 where public.community_ai_studio_is_author(author_id,guest_key)
 group by post_id
) a where p.id=a.post_id;
