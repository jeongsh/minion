set lock_timeout = '5s';

alter table public.community_posts
  add column event_winner_count integer check (event_winner_count between 1 and 100),
  add column event_drawn_at timestamptz;

-- Authors can update posts through the Data API, but event settings/results are
-- server-owned and the configured prize count cannot change after publication.
create function public.protect_community_event_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.event_winner_count is distinct from old.event_winner_count then
      raise exception '등록 후 당첨 인원은 변경할 수 없습니다.';
    end if;
    if new.event_drawn_at is distinct from old.event_drawn_at and current_user not in ('postgres', 'service_role') then
      raise exception '이벤트 결과는 서버에서만 변경할 수 있습니다.';
    end if;
  elsif (new.event_winner_count is not null or new.event_drawn_at is not null) and current_user not in ('postgres', 'service_role') then
    raise exception '이벤트는 서버에서만 등록할 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_community_event_fields() from public, anon, authenticated;
create trigger protect_community_event_fields before insert or update on public.community_posts
  for each row execute function public.protect_community_event_fields();

create table public.community_event_entries (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_winner boolean not null default false,
  primary key (post_id, user_id)
);
create index community_event_entries_user_idx on public.community_event_entries(user_id);
alter table public.community_event_entries enable row level security;
revoke all on public.community_event_entries from public, anon, authenticated;
grant all on public.community_event_entries to service_role;

alter table public.community_notifications drop constraint community_notifications_kind_check;
alter table public.community_notifications add constraint community_notifications_kind_check
  check (kind in ('post_comment', 'comment_reply', 'admin_report', 'admin_block', 'prediction_result', 'event_winner'));

-- Server-only RPC. The caller verifies the session and supplies its user ID.
-- Both entry and draw lock the post, so an entry cannot race past the draw.
create function public.mutate_community_event(p_post_id uuid, p_user_id uuid, p_draw boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  p public.community_posts%rowtype;
  event_href text;
  team_slug text;
  notifications jsonb;
begin
  if p_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if exists (select 1 from public.community_user_sanctions where user_id = p_user_id and lifted_at is null) then
    raise exception '커뮤니티 이용이 제한된 계정입니다.';
  end if;
  select * into p from public.community_posts where id = p_post_id for update;
  if not found or p.event_winner_count is null or p.deleted_at is not null or p.blinded_at is not null then
    raise exception '참여할 수 없는 이벤트입니다.';
  end if;
  if p.event_drawn_at is not null then raise exception '이미 종료된 이벤트입니다.'; end if;
  if not p_draw then
    if p.author_id = p_user_id then raise exception '작성자는 참여할 수 없습니다.'; end if;
    insert into public.community_event_entries(post_id, user_id) values (p_post_id, p_user_id)
      on conflict (post_id, user_id) do nothing;
    return '[]'::jsonb;
  end if;
  if p.author_id is distinct from p_user_id then raise exception '작성자만 추첨할 수 있습니다.'; end if;
  if not exists (select 1 from public.community_event_entries e where e.post_id = p_post_id
    and not exists (select 1 from public.community_user_sanctions s where s.user_id = e.user_id and s.lifted_at is null)) then
    raise exception '추첨할 참여자가 없습니다.';
  end if;
  update public.community_event_entries set is_winner = true
  where post_id = p_post_id and user_id in (
    select e.user_id from public.community_event_entries e where e.post_id = p_post_id
      and not exists (select 1 from public.community_user_sanctions s where s.user_id = e.user_id and s.lifted_at is null)
    order by random() limit p.event_winner_count
  );
  update public.community_posts set event_drawn_at = now() where id = p_post_id;
  if p.site_scope = 'team' and p.team_id is not null then
    select coalesce(nullif(fan_site_host, ''), slug) into team_slug from public.teams where id = p.team_id;
  end if;
  event_href := case when team_slug is null then '/community/post/' else '/fan/' || team_slug || '/community/post/' end || p_post_id::text;
  with inserted as (
    insert into public.community_notifications(recipient_user_id, actor_user_id, actor_name, kind, post_id, title, description, href, dedupe_key)
    select e.user_id, p_user_id, '이벤트', 'event_winner', p_post_id, '이벤트에 당첨됐어요', p.title, event_href,
      'event-winner:' || p_post_id::text || ':' || e.user_id::text
    from public.community_event_entries e where e.post_id = p_post_id and e.is_winner
    on conflict (dedupe_key) do nothing
    returning id, recipient_user_id, title, description, href
  ) select coalesce(jsonb_agg(to_jsonb(inserted)), '[]'::jsonb) into notifications from inserted;
  return notifications;
end;
$$;
revoke all on function public.mutate_community_event(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.mutate_community_event(uuid, uuid, boolean) to service_role;
notify pgrst, 'reload schema';
