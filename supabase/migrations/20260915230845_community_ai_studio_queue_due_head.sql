create or replace function public.community_ai_studio_tick() returns integer
language plpgsql set search_path='' as $$
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
       update public.community_ai_studio_queue set due_at=now()+interval '1 minute' where id=q.id; continue;
     end if;
     insert into public.community_comments(id,post_id,parent_id,author_id,guest_key,guest_nickname,content)
     values(q.id,q.post_id,q.parent_id,q.author_id,q.guest_key,q.guest_nickname,q.content||E'\n[AI 캐릭터]');
     if q.guest_key is not null then insert into public.community_guest_comment_credentials(comment_id,guest_key,ip_key,ip_label) values(q.id,q.guest_key,null,null); end if;
     update public.community_posts set comment_count=comment_count+1 where id=q.post_id;
     update public.community_ai_studio_queue set status='published',published_at=now(),error=null where id=q.id;
     -- Delayed runs do not dump all overdue comments at once.
     update public.community_ai_studio_queue set due_at=greatest(due_at,now()+interval '3 minutes') where post_id=q.post_id and status='scheduled';
     posted:=posted+1;
   exception when others then
     update public.community_ai_studio_queue set status='failed',error='댓글 게시 실패: 작성자·답변 대상·제약 조건을 확인하세요.' where id=q.id;
     update public.community_ai_studio_campaigns set state='paused',updated_at=now() where post_id=q.post_id;
     update public.community_ai_studio_queue set status='paused' where post_id=q.post_id and status='scheduled';
   end;
 end loop;
 return posted;
end $$;
