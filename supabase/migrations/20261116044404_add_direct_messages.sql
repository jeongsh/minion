create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  sender_deleted_at timestamptz,
  recipient_deleted_at timestamptz,
  constraint direct_messages_distinct_users check (sender_id <> recipient_id)
);

create index direct_messages_inbox on public.direct_messages(recipient_id, created_at desc, id desc) where recipient_deleted_at is null;
create index direct_messages_sent on public.direct_messages(sender_id, created_at desc, id desc);

alter table public.direct_messages enable row level security;
revoke all on public.direct_messages from anon, authenticated;
grant select on public.direct_messages to authenticated;
grant insert (recipient_id, body) on public.direct_messages to authenticated;
grant update (read_at, sender_deleted_at, recipient_deleted_at) on public.direct_messages to authenticated;
grant all on public.direct_messages to service_role;

create policy "participants read own messages" on public.direct_messages for select to authenticated
using (((select auth.uid()) = sender_id and sender_deleted_at is null)
    or ((select auth.uid()) = recipient_id and recipient_deleted_at is null));
create policy "send own messages" on public.direct_messages for insert to authenticated
with check ((select auth.uid()) = sender_id);
create policy "participants update own messages" on public.direct_messages for update to authenticated
using ((select auth.uid()) in (sender_id, recipient_id))
with check ((select auth.uid()) in (sender_id, recipient_id));

-- Private trigger needs access to both directions of blocks and to sanctions.
-- Column grants and the trigger prevent forged senders, timestamps and receipts.
create function private.guard_direct_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception '로그인이 필요합니다.' using errcode = 'P0001'; end if;
  if TG_OP = 'INSERT' then
    if new.sender_id <> actor then raise exception '발신자가 일치하지 않습니다.'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text, 731));
    if exists (select 1 from public.community_user_blocks b
      where (b.blocker_id = actor and b.blocked_id = new.recipient_id)
         or (b.blocker_id = new.recipient_id and b.blocked_id = actor)) then
      raise exception '쪽지를 보낼 수 없는 상대입니다.';
    end if;
    if exists (select 1 from public.community_user_sanctions s
      where s.user_id in (actor, new.recipient_id) and s.lifted_at is null) then
      raise exception '이용이 제한된 계정은 쪽지를 주고받을 수 없습니다.';
    end if;
    if (select count(*) from public.direct_messages where sender_id = actor and created_at > now() - interval '1 minute') >= 10
      or (select count(*) from public.direct_messages where sender_id = actor and created_at > now() - interval '1 day') >= 100 then
      raise exception '발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.';
    end if;
    new.body := btrim(new.body);
    new.created_at := now();
    new.read_at := null;
    new.sender_deleted_at := null;
    new.recipient_deleted_at := null;
  else
    if actor = old.sender_id then
      if new.read_at is distinct from old.read_at or new.recipient_deleted_at is distinct from old.recipient_deleted_at then
        raise exception '상대방의 쪽지 상태를 변경할 수 없습니다.';
      end if;
      new.sender_deleted_at := coalesce(old.sender_deleted_at, case when new.sender_deleted_at is not null then now() end);
    elsif actor = old.recipient_id then
      if new.sender_deleted_at is distinct from old.sender_deleted_at then
        raise exception '상대방의 쪽지 상태를 변경할 수 없습니다.';
      end if;
      new.read_at := coalesce(old.read_at, case when new.read_at is not null then now() end);
      new.recipient_deleted_at := coalesce(old.recipient_deleted_at, case when new.recipient_deleted_at is not null then now() end);
    else raise exception '쪽지에 접근할 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_direct_message() from public, anon, authenticated;
create trigger guard_direct_message before insert or update on public.direct_messages
for each row execute function private.guard_direct_message();
