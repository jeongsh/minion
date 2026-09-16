-- Durable reviewed comment queue. Browser clients never access these tables/RPCs.
create table public.community_ai_studio_settings (
  singleton boolean primary key default true check(singleton),
  guest_key text,
  watch_enabled boolean not null default true
);
insert into public.community_ai_studio_settings(singleton) values(true);
create table public.community_ai_studio_campaigns (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  draft_hash text not null,
  state text not null default 'active' check(state in ('active','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.community_ai_studio_queue (
  id uuid primary key,
  post_id uuid not null references public.community_ai_studio_campaigns(post_id) on delete cascade,
  ordinal integer not null,
  persona_id text not null,
  author_id uuid references auth.users(id),
  guest_key text,
  guest_nickname text,
  content text not null check(char_length(content) between 1 and 600),
  parent_id uuid,
  due_at timestamptz not null,
  status text not null default 'scheduled' check(status in ('scheduled','paused','published','cancelled','failed')),
  error text,
  published_at timestamptz,
  unique(post_id,ordinal),
  check((author_id is not null and guest_key is null and guest_nickname is null) or (author_id is null and guest_key is not null and guest_nickname='비로그인 유저'))
);
create index community_ai_studio_queue_due on public.community_ai_studio_queue(due_at) where status='scheduled';
create index community_ai_studio_queue_author on public.community_ai_studio_queue(author_id);
create table public.community_ai_studio_inbox (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.community_posts(id) on delete cascade,
  comment_id uuid references public.community_comments(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','drafted','dismissed','approved')),
  event_type text not null check(event_type in ('post','comment')),
  response_persona text,
  response_text text,
  approved_comment_id uuid,
  created_at timestamptz not null default now()
);
create index community_ai_studio_inbox_comment on public.community_ai_studio_inbox(comment_id);
alter table public.community_ai_studio_settings enable row level security;
alter table public.community_ai_studio_campaigns enable row level security;
alter table public.community_ai_studio_queue enable row level security;
alter table public.community_ai_studio_inbox enable row level security;
revoke all on public.community_ai_studio_settings,public.community_ai_studio_campaigns,public.community_ai_studio_queue,public.community_ai_studio_inbox from anon,authenticated;
grant all on public.community_ai_studio_settings,public.community_ai_studio_campaigns,public.community_ai_studio_queue,public.community_ai_studio_inbox to service_role;

create function public.community_ai_studio_is_author(p_author uuid,p_guest text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=p_author and raw_app_meta_data->>'is_ai'='true' and raw_app_meta_data->>'community_studio_persona_id' in ('t1-optimist','geng-fan','t1-partisan','hle-kind','neutral-analyst'))
 or exists(select 1 from public.community_ai_studio_settings where singleton and guest_key=p_guest and guest_key is not null)
$$;
revoke all on function public.community_ai_studio_is_author(uuid,text) from public,anon,authenticated;
grant execute on function public.community_ai_studio_is_author(uuid,text) to service_role;

create function public.community_ai_studio_matches_author(p_author uuid,p_guest text,p_persona text) returns boolean
language sql stable security definer set search_path='' as $$
 select public.community_ai_studio_is_author(p_author,p_guest) and
 ((p_author is null and p_persona='unaffiliated-baiter') or exists(select 1 from auth.users where id=p_author and raw_app_meta_data->>'community_studio_persona_id'=p_persona))
$$;
revoke all on function public.community_ai_studio_matches_author(uuid,text,text) from public,anon,authenticated;
grant execute on function public.community_ai_studio_matches_author(uuid,text,text) to service_role;

-- Definer is needed to keep internal event rows private from ordinary community writers.
create function public.community_ai_studio_capture_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if public.community_ai_studio_is_author(new.author_id,new.guest_key) then return new; end if;
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
end $$;
revoke all on function public.community_ai_studio_capture_activity() from public,anon,authenticated;
create trigger community_ai_studio_new_post after insert on public.community_posts for each row execute function public.community_ai_studio_capture_activity();
create trigger community_ai_studio_new_comment after insert on public.community_comments for each row execute function public.community_ai_studio_capture_activity();

create function public.community_ai_studio_enqueue(p_post uuid,p_hash text,p_items jsonb) returns void
language plpgsql set search_path='' as $$
declare c public.community_ai_studio_campaigns; item jsonb;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>12 then raise exception 'Invalid queue'; end if;
 insert into public.community_ai_studio_campaigns(post_id,draft_hash) values(p_post,p_hash) on conflict do nothing;
 select * into c from public.community_ai_studio_campaigns where post_id=p_post for update;
 if c.draft_hash<>p_hash then raise exception 'Draft changed after publish'; end if;
 if exists(select 1 from public.community_ai_studio_queue where post_id=p_post) then return; end if;
 for item in select * from jsonb_array_elements(p_items) loop
   if not public.community_ai_studio_matches_author((item->>'author_id')::uuid,item->>'guest_key',item->>'persona_id') then raise exception 'Unknown AI author'; end if;
   insert into public.community_ai_studio_queue(id,post_id,ordinal,persona_id,author_id,guest_key,guest_nickname,content,parent_id,due_at)
   values((item->>'id')::uuid,p_post,(item->>'ordinal')::integer,item->>'persona_id',(item->>'author_id')::uuid,item->>'guest_key',item->>'guest_nickname',item->>'content',(item->>'parent_id')::uuid,(item->>'due_at')::timestamptz);
 end loop;
 -- A user may have joined between creating the post and enqueuing its comments.
 if exists(select 1 from public.community_comments where post_id=p_post and not public.community_ai_studio_is_author(author_id,guest_key)) then
   update public.community_ai_studio_campaigns set state='paused' where post_id=p_post;
   update public.community_ai_studio_queue set status='paused',error='실제 유저 참여로 검토 대기' where post_id=p_post;
 end if;
end $$;
revoke all on function public.community_ai_studio_enqueue(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_ai_studio_enqueue(uuid,text,jsonb) to service_role;

create function public.community_ai_studio_tick() returns integer
language plpgsql set search_path='' as $$
declare c public.community_ai_studio_campaigns; q public.community_ai_studio_queue; posted integer:=0;
begin
 for c in select * from public.community_ai_studio_campaigns x where state='active' and exists(select 1 from public.community_ai_studio_queue y where y.post_id=x.post_id and y.status='scheduled' and y.due_at<=now()) order by created_at limit 100 for update skip locked loop
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
revoke all on function public.community_ai_studio_tick() from public,anon,authenticated;
grant execute on function public.community_ai_studio_tick() to service_role;
select cron.schedule('community-ai-studio-comments','* * * * *','select public.community_ai_studio_tick();');

create function public.community_ai_studio_control(p_post uuid,p_action text,p_queue uuid default null,p_due timestamptz default null,p_text text default null) returns void
language plpgsql set search_path='' as $$
declare next_due timestamptz:=now()+interval '3 minutes'; q record;
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
     next_due:=next_due+interval '3 minutes';
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
end $$;
revoke all on function public.community_ai_studio_control(uuid,text,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.community_ai_studio_control(uuid,text,uuid,timestamptz,text) to service_role;

alter table public.community_ai_studio_inbox add column context_hash text;
create function public.community_ai_studio_approve_reply(p_event uuid,p_author uuid,p_persona text,p_text text,p_hash text) returns uuid
language plpgsql set search_path='' as $$
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
 values(cid,e.post_id,coalesce((select max(ordinal)+1 from public.community_ai_studio_queue where post_id=e.post_id),0),p_persona,p_author,p_text,parent,now()+interval '2 minutes');
 update public.community_ai_studio_inbox set status='approved',approved_comment_id=cid,response_text=p_text where id=e.id;
 -- Re-enable only the approved response; old reservation rows stay paused.
 update public.community_ai_studio_campaigns set state='active',updated_at=now() where post_id=e.post_id;
 return cid;
end $$;
revoke all on function public.community_ai_studio_approve_reply(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.community_ai_studio_approve_reply(uuid,uuid,text,text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('community-ai-media','community-ai-media',true,33554432,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm'])
on conflict(id) do nothing;
