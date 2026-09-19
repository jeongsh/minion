-- Random delays include both endpoints (0 and 300 seconds).
-- Keep RPC signatures and service-role-only permissions unchanged.

CREATE OR REPLACE FUNCTION public.community_ai_studio_approve_reply(p_event uuid, p_author uuid, p_persona text, p_text text, p_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e public.community_ai_studio_inbox; cid uuid:=gen_random_uuid(); parent uuid;
begin
 select * into e from public.community_ai_studio_inbox where id=p_event;
 if not found then raise exception 'Review missing'; end if;
 insert into public.community_ai_studio_campaigns(post_id,draft_hash,state) values(e.post_id,'reply:'||e.id,'paused') on conflict do nothing;
 -- Same lock order as organic comment capture: campaign, then inbox.
 perform 1 from public.community_ai_studio_campaigns where post_id=e.post_id for update;
 select * into e from public.community_ai_studio_inbox where id=p_event for update;
 if not found then raise exception 'Review missing'; end if;
 if e.status='approved' then return e.approved_comment_id; end if;
 if e.status<>'drafted' or e.context_hash is distinct from p_hash or char_length(p_text) not between 1 and 380 then raise exception 'Review changed'; end if;
 if p_persona not in ('t1-optimist','geng-fan','hle-kind','neutral-analyst') or not public.community_ai_studio_matches_author(p_author,null,p_persona) then raise exception 'Reply author not allowed'; end if;
 if not exists(select 1 from public.community_posts where id=e.post_id and deleted_at is null and blinded_at is null) then raise exception 'Post unavailable'; end if;
 if e.comment_id is not null then
   select coalesce(parent_id,id) into parent from public.community_comments where id=e.comment_id and deleted_at is null and blinded_at is null;
   if not found then raise exception 'Comment unavailable'; end if;
 end if;
 if exists(select 1 from public.community_ai_studio_campaigns where post_id=e.post_id) then
   -- Reviewed human replies may coexist with paused original reservations.
   perform 1 from public.community_ai_studio_campaigns where post_id=e.post_id for update;
 else insert into public.community_ai_studio_campaigns(post_id,draft_hash,state) values(e.post_id,'reply:'||e.id,'active');
 end if;
 insert into public.community_ai_studio_queue(id,post_id,ordinal,persona_id,author_id,content,parent_id,due_at)
 values(cid,e.post_id,coalesce((select max(ordinal)+1 from public.community_ai_studio_queue where post_id=e.post_id),0),p_persona,p_author,p_text,parent,now()+make_interval(secs => floor(random()*301)::integer));
 update public.community_ai_studio_inbox set status='approved',approved_comment_id=cid,response_text=p_text where id=e.id;
 -- Re-enable only the approved response; old reservation rows stay paused.
 update public.community_ai_studio_campaigns set state='active',updated_at=now() where post_id=e.post_id;
 return cid;
end $function$;

CREATE OR REPLACE FUNCTION public.community_ai_studio_control(p_post uuid, p_action text, p_queue uuid DEFAULT NULL::uuid, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_text text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare next_due timestamptz:=now()+make_interval(secs => floor(random()*301)::integer); q record;
begin
 perform 1 from public.community_ai_studio_campaigns where post_id=p_post for update;
 if not found then raise exception 'Campaign missing'; end if;
 if p_action in ('pause','cancel') then
   update public.community_ai_studio_campaigns set state=case when p_action='pause' then 'paused' else 'cancelled' end,updated_at=now() where post_id=p_post;
   update public.community_ai_studio_queue set status=case when p_action='pause' then 'paused' else 'cancelled' end where post_id=p_post and status in ('scheduled','paused','failed');
 elsif p_action='resume' then
   if exists(select 1 from public.community_ai_studio_campaigns where post_id=p_post and state='cancelled') then raise exception 'Cancelled campaign'; end if;
   for q in select id from public.community_ai_studio_queue where post_id=p_post and status in ('scheduled','paused','failed') order by ordinal for update loop
     update public.community_ai_studio_queue set status='scheduled',due_at=next_due,error=null where id=q.id;
     next_due:=next_due+make_interval(secs => floor(random()*301)::integer);
   end loop;
   update public.community_ai_studio_campaigns set state='active',updated_at=now() where post_id=p_post;
 elsif p_action='edit' then
   if p_due<now() or p_due>now()+interval '7 days' or p_due is null or p_text is null or char_length(p_text) not between 1 and 600 then raise exception 'Invalid edit'; end if;
   update public.community_ai_studio_queue set due_at=p_due,content=p_text where id=p_queue and post_id=p_post and status in ('scheduled','paused','failed');
   if not found then raise exception 'Comment already published or missing'; end if;
 elsif p_action='cancel_item' then
   update public.community_ai_studio_queue set status='cancelled' where id=p_queue and post_id=p_post and status in ('scheduled','paused','failed');
 else raise exception 'Unknown action';
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.community_ai_studio_enqueue(p_post uuid, p_hash text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c public.community_ai_studio_campaigns; item jsonb; next_due timestamptz:=now();
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>12 then raise exception 'Invalid queue'; end if;
 insert into public.community_ai_studio_campaigns(post_id,draft_hash) values(p_post,p_hash) on conflict do nothing;
 select * into c from public.community_ai_studio_campaigns where post_id=p_post for update;
 if c.draft_hash<>p_hash then raise exception 'Draft changed after publish'; end if;
 if exists(select 1 from public.community_ai_studio_queue where post_id=p_post) then return; end if;
 for item in select value from jsonb_array_elements(p_items) order by (value->>'ordinal')::integer loop
   if not public.community_ai_studio_matches_author((item->>'author_id')::uuid,item->>'guest_key',item->>'persona_id') then raise exception 'Unknown AI author'; end if;
   next_due:=next_due+make_interval(secs => floor(random()*301)::integer);
   insert into public.community_ai_studio_queue(id,post_id,ordinal,persona_id,author_id,guest_key,guest_nickname,content,parent_id,due_at)
   values((item->>'id')::uuid,p_post,(item->>'ordinal')::integer,item->>'persona_id',(item->>'author_id')::uuid,item->>'guest_key',item->>'guest_nickname',item->>'content',(item->>'parent_id')::uuid,next_due);
 end loop;
 -- A user may have joined between creating the post and enqueuing its comments.
 if exists(select 1 from public.community_comments where post_id=p_post and not public.community_ai_studio_is_author(author_id,guest_key)) then
   update public.community_ai_studio_campaigns set state='paused' where post_id=p_post;
   update public.community_ai_studio_queue set status='paused',error='실제 유저 참여로 검토 대기' where post_id=p_post;
 end if;
end $function$;

CREATE OR REPLACE FUNCTION public.community_ai_studio_tick()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c public.community_ai_studio_campaigns; q public.community_ai_studio_queue; posted integer:=0;
begin
 for c in select * from public.community_ai_studio_campaigns x where state='active' and (select y.due_at from public.community_ai_studio_queue y where y.post_id=x.post_id and y.status='scheduled' order by y.ordinal limit 1)<=now() order by created_at limit 100 for update skip locked loop
   if not exists(select 1 from public.community_posts where id=c.post_id and deleted_at is null and blinded_at is null) then
     update public.community_ai_studio_campaigns set state='cancelled',updated_at=now() where post_id=c.post_id;
     update public.community_ai_studio_queue set status='cancelled',error='게시글 삭제 또는 블라인드' where post_id=c.post_id and status in ('scheduled','paused');
     continue;
   end if;
   select * into q from public.community_ai_studio_queue where post_id=c.post_id and status='scheduled' order by ordinal limit 1 for update;
   if not found or q.due_at>now() then continue; end if;
   begin
     if not public.community_ai_studio_matches_author(q.author_id,q.guest_key,q.persona_id) then raise exception 'AI 계정 확인 실패'; end if;
     if exists(select 1 from public.community_user_sanctions where user_id=q.author_id and lifted_at is null) or exists(select 1 from public.community_guest_sanctions where guest_key=q.guest_key and lifted_at is null) then raise exception '작성자 이용 제한'; end if;
     if q.parent_id is not null and not exists(select 1 from public.community_comments where id=q.parent_id and post_id=q.post_id and deleted_at is null and blinded_at is null) then raise exception '답변 대상 댓글 확인 필요'; end if;
     if q.guest_key is not null and (exists(select 1 from public.community_guest_comment_credentials where guest_key=q.guest_key and created_at>now()-interval '30 seconds') or (select count(*) from public.community_guest_comment_credentials where guest_key=q.guest_key and created_at>now()-interval '10 minutes')>=5) then
       update public.community_ai_studio_queue set due_at=due_at+(now()-q.due_at)+interval '1 minute' where post_id=q.post_id and status='scheduled'; continue;
     end if;
     insert into public.community_comments(id,post_id,parent_id,author_id,guest_key,guest_nickname,content)
     values(q.id,q.post_id,q.parent_id,q.author_id,q.guest_key,q.guest_nickname,q.content);
     if q.guest_key is not null then insert into public.community_guest_comment_credentials(comment_id,guest_key,ip_key,ip_label) values(q.id,q.guest_key,null,null); end if;
     update public.community_posts set comment_count=comment_count+1 where id=q.post_id;
     update public.community_ai_studio_queue set status='published',published_at=now(),error=null where id=q.id;
     -- Shift the remaining schedule by the actual delay, preserving random gaps.
     update public.community_ai_studio_queue set due_at=due_at+(now()-q.due_at) where post_id=q.post_id and status='scheduled';
     posted:=posted+1;
   exception when others then
     update public.community_ai_studio_queue set status='failed',error='댓글 게시 실패: 작성자·답변 대상·제약 조건을 확인하세요.' where id=q.id;
     update public.community_ai_studio_campaigns set state='paused',updated_at=now() where post_id=q.post_id;
     update public.community_ai_studio_queue set status='paused' where post_id=q.post_id and status='scheduled';
   end;
 end loop;
 return posted;
end $function$;

-- Seconds precision without rounding every reservation up to the next minute.
select cron.alter_job(job_id := (select jobid from cron.job where jobname='community-ai-studio-comments'), schedule := '1 second');
