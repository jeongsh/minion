-- Durable automatic replies for studio posts. Public clients cannot claim or finish jobs.
alter table public.community_ai_studio_campaigns add column auto_reply_enabled boolean not null default true;
-- Existing explicit pauses/cancellations remain stopped.
update public.community_ai_studio_campaigns set auto_reply_enabled=false where state<>'active';
alter table public.community_ai_studio_inbox
 add column activity_version bigint not null default 0,
 add column generation_token uuid,
 add column lease_until timestamptz,
 add column retry_at timestamptz not null default now(),
 add column attempts integer not null default 0,
 add column last_error text;
create index community_ai_studio_inbox_retry on public.community_ai_studio_inbox(retry_at) where status in ('pending','drafted');

create or replace function public.community_ai_studio_capture_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; campaign public.community_ai_studio_campaigns;
begin
 if public.community_ai_studio_is_author(new.author_id,new.guest_key) then
   if tg_table_name='community_comments' and tg_op='INSERT' then
     update public.community_posts set view_count=coalesce(view_count,0)+1 where id=new.post_id;
   end if;
   return new;
 end if;
 if tg_op='INSERT' and (new.deleted_at is not null or new.blinded_at is not null) then return new; end if;
 if tg_table_name='community_comments' then
   target:=new.post_id;
   -- All writers lock campaign before inbox, including completion and manual controls.
   select * into campaign from public.community_ai_studio_campaigns where post_id=target for update;
   if found and campaign.state<>'cancelled' then
     update public.community_ai_studio_queue set status='cancelled',error='새 사용자 참여로 최신 맥락에서 자동 재생성'
       where post_id=target and status in ('scheduled','paused','failed');
   end if;
 else target:=new.id;
 end if;
 if new.deleted_at is not null or new.blinded_at is not null then
   update public.community_ai_studio_inbox set activity_version=activity_version+1,generation_token=null,lease_until=null,context_hash=null,status='dismissed' where post_id=target;
   return new;
 end if;
 if exists(select 1 from public.community_ai_studio_settings where singleton and watch_enabled) then
   insert into public.community_ai_studio_inbox(post_id,comment_id,event_type,retry_at)
   values(target,case when tg_table_name='community_comments' then new.id else null end,
     case when tg_table_name='community_comments' then 'comment' else 'post' end,now()+interval '15 seconds')
   on conflict(post_id) do update set
     comment_id=excluded.comment_id,event_type=excluded.event_type,status='pending',
     activity_version=community_ai_studio_inbox.activity_version+1,context_hash=null,
     response_persona=null,response_text=null,approved_comment_id=null,
     generation_token=null,lease_until=null,retry_at=excluded.retry_at,attempts=0,last_error=null;
 else
   -- Even when automatic replies are disabled, never publish an in-flight stale answer.
   update public.community_ai_studio_inbox set activity_version=activity_version+1,
     generation_token=null,lease_until=null,context_hash=null,status='dismissed' where post_id=target;
 end if;
 return new;
end $$;

create trigger community_ai_studio_changed_comment after update of content,deleted_at,blinded_at on public.community_comments
for each row when (old.content is distinct from new.content or old.deleted_at is distinct from new.deleted_at or old.blinded_at is distinct from new.blinded_at)
execute function public.community_ai_studio_capture_activity();

create function public.community_ai_studio_claim_replies(p_limit integer default 3)
returns setof public.community_ai_studio_inbox language plpgsql set search_path='' as $$
begin
 return query
 with due as (
   select i.id from public.community_ai_studio_inbox i
   join public.community_ai_studio_campaigns c on c.post_id=i.post_id
   join public.community_posts p on p.id=i.post_id
   where i.status in ('pending','drafted') and i.retry_at<=now()
     and (i.lease_until is null or i.lease_until<=now())
     and c.state='active' and c.auto_reply_enabled
     and p.deleted_at is null and p.blinded_at is null
     and exists(select 1 from public.community_ai_studio_settings where singleton and watch_enabled)
   order by i.retry_at,i.id limit least(greatest(p_limit,1),5) for update of i skip locked
 )
 update public.community_ai_studio_inbox i set generation_token=gen_random_uuid(),
   lease_until=now()+interval '3 minutes',attempts=attempts+1
 from due where i.id=due.id returning i.*;
end $$;
revoke all on function public.community_ai_studio_claim_replies(integer) from public,anon,authenticated;
grant execute on function public.community_ai_studio_claim_replies(integer) to service_role;

create function public.community_ai_studio_finish_reply(
 p_event uuid,p_version bigint,p_token uuid,p_author uuid default null,p_persona text default null,
 p_text text default null,p_hash text default null,p_error text default null)
returns boolean language plpgsql set search_path='' as $$
declare e public.community_ai_studio_inbox; campaign public.community_ai_studio_campaigns;
begin
 select * into e from public.community_ai_studio_inbox where id=p_event;
 if not found then return false; end if;
 select * into campaign from public.community_ai_studio_campaigns where post_id=e.post_id for update;
 if not found or not campaign.auto_reply_enabled or campaign.state<>'active' then return false; end if;
 select * into e from public.community_ai_studio_inbox where id=p_event for update;
 if e.activity_version<>p_version or e.generation_token is distinct from p_token or p_token is null
   or e.lease_until<=now() or e.status not in ('pending','drafted') then return false; end if;
 if not exists(select 1 from public.community_ai_studio_settings where singleton and watch_enabled) then
   update public.community_ai_studio_inbox set generation_token=null,lease_until=null where id=e.id;
   return false;
 end if;
 if p_error is not null then
   update public.community_ai_studio_inbox set status='pending',generation_token=null,lease_until=null,
     retry_at=now()+make_interval(secs=>least(900,30*power(2,least(attempts,5)))::integer),
     last_error=left(p_error,500) where id=e.id;
   return true;
 end if;
 if p_text is null then
   update public.community_ai_studio_inbox set status='dismissed',generation_token=null,lease_until=null,last_error=null where id=e.id;
   return true;
 end if;
 if e.status<>'drafted' or e.context_hash is distinct from p_hash
   or e.response_text is distinct from p_text or e.response_persona is distinct from p_persona then return false; end if;
 perform public.community_ai_studio_approve_reply(p_event,p_author,p_persona,p_text,p_hash);
 update public.community_ai_studio_inbox set generation_token=null,lease_until=null,last_error=null where id=e.id;
 return true;
end $$;
revoke all on function public.community_ai_studio_finish_reply(uuid,bigint,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.community_ai_studio_finish_reply(uuid,bigint,uuid,uuid,text,text,text,text) to service_role;

CREATE OR REPLACE FUNCTION public.community_ai_studio_control(p_post uuid, p_action text, p_queue uuid DEFAULT NULL::uuid, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_text text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare next_due timestamptz:=now()+make_interval(secs => floor(random()*301)::integer); q record;
begin
 perform 1 from public.community_ai_studio_campaigns where post_id=p_post for update;
 if not found then raise exception 'Campaign missing'; end if;
 if p_action in ('pause','cancel','resume') then
   update public.community_ai_studio_inbox set generation_token=null,lease_until=null where post_id=p_post;
 end if;
 if p_action in ('pause','cancel') then
   update public.community_ai_studio_campaigns set auto_reply_enabled=false,state=case when p_action='pause' then 'paused' else 'cancelled' end,updated_at=now() where post_id=p_post;
   update public.community_ai_studio_queue set status=case when p_action='pause' then 'paused' else 'cancelled' end where post_id=p_post and status in ('scheduled','paused','failed');
 elsif p_action='resume' then
   if exists(select 1 from public.community_ai_studio_campaigns where post_id=p_post and state='cancelled') then raise exception 'Cancelled campaign'; end if;
   for q in select id from public.community_ai_studio_queue where post_id=p_post and status in ('scheduled','paused','failed') order by ordinal for update loop
     update public.community_ai_studio_queue set status='scheduled',due_at=next_due,error=null where id=q.id;
     next_due:=next_due+make_interval(secs => floor(random()*301)::integer);
   end loop;
   update public.community_ai_studio_campaigns set auto_reply_enabled=true,state='active',updated_at=now() where post_id=p_post;
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
   update public.community_ai_studio_queue set status='cancelled',error='새 사용자 참여로 최신 맥락에서 자동 재생성' where post_id=p_post;
 end if;
end $function$;


create or replace function private.invoke_community_ai_replies()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site_url text;
  v_cron_secret text;
  v_vercel_bypass text;
  v_request_id bigint;
begin
  if not exists(select 1 from public.community_ai_studio_inbox i join public.community_ai_studio_campaigns c on c.post_id=i.post_id join public.community_posts p on p.id=i.post_id where i.status in ('pending','drafted') and i.retry_at<=now() and (i.lease_until is null or i.lease_until<=now()) and c.state='active' and c.auto_reply_enabled and p.deleted_at is null and p.blinded_at is null) or not exists(select 1 from public.community_ai_studio_settings where singleton and watch_enabled) then return null; end if;
  select decrypted_secret into v_site_url
  from vault.decrypted_secrets
  where name = 'lckhub_automation_url';

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets
  where name = 'lckhub_automation_secret';

  select decrypted_secret into v_vercel_bypass
  from vault.decrypted_secrets
  where name = 'lckhub_vercel_bypass';

  if nullif(v_site_url, '') is null
    or nullif(v_cron_secret, '') is null
    or nullif(v_vercel_bypass, '') is null then
    raise exception 'Community AI reply automation Vault secrets are not configured';
  end if;

  select net.http_get(
    url := rtrim(v_site_url, '/') || '/api/cron/community-ai-replies',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_cron_secret,
      'X-Vercel-Protection-Bypass', v_vercel_bypass,
      'User-Agent', 'Supabase-Cron/LCKHub-Minion'
    ),
    timeout_milliseconds := 290000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.invoke_community_ai_replies()
  from public, anon, authenticated;


select cron.schedule('community-ai-studio-auto-replies','* * * * *','select private.invoke_community_ai_replies()');
