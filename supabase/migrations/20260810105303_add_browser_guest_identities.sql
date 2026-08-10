-- 비회원 공개 신원은 브라우저 쿠키 기반 guest_key와 자동 닉네임만 사용한다.
-- IP 기반 식별자는 service_role 전용 자격정보 테이블에 분리해 공개 응답에서 제거한다.

alter table public.community_guest_post_credentials
  add column if not exists ip_key text,
  add column if not exists ip_label text,
  alter column password_hash drop not null;

alter table public.community_guest_comment_credentials
  add column if not exists ip_key text,
  add column if not exists ip_label text,
  alter column password_hash drop not null;

-- 기존 구현에서는 guest_key가 IP HMAC이었으므로 운영 정보로 안전하게 이관한다.
update public.community_guest_post_credentials c
set
  ip_key = coalesce(c.ip_key, c.guest_key),
  ip_label = coalesce(c.ip_label, p.guest_ip_label)
from public.community_posts p
where p.id = c.post_id
  and (c.ip_key is null or c.ip_label is null);

update public.community_guest_comment_credentials c
set
  ip_key = coalesce(c.ip_key, c.guest_key),
  ip_label = coalesce(c.ip_label, m.guest_ip_label)
from public.community_comments m
where m.id = c.comment_id
  and (c.ip_key is null or c.ip_label is null);

create index if not exists idx_guest_post_credentials_ip_created
  on public.community_guest_post_credentials(ip_key, created_at desc)
  where ip_key is not null;

create index if not exists idx_guest_comment_credentials_ip_created
  on public.community_guest_comment_credentials(ip_key, created_at desc)
  where ip_key is not null;

alter table public.community_guest_blocks
  add column if not exists guest_nickname text,
  alter column guest_ip_label drop not null;

update public.community_guest_blocks
set guest_nickname = coalesce(guest_nickname, '비회원')
where guest_nickname is null;

alter table public.community_guest_blocks
  drop constraint if exists community_guest_blocks_nickname_check,
  add constraint community_guest_blocks_nickname_check
    check (guest_nickname is null or char_length(guest_nickname) between 2 and 16);

alter table public.community_guest_sanctions
  add column if not exists ip_key text,
  add column if not exists guest_nickname text,
  alter column guest_key drop not null,
  alter column guest_ip_label drop not null;

-- 기존 제재는 IP 기준 제재였으므로 ip_key로 의미를 보존한다.
update public.community_guest_sanctions
set ip_key = coalesce(ip_key, guest_key), guest_key = null
where ip_key is null;

drop index if exists public.idx_community_guest_sanctions_active;

create unique index if not exists idx_community_guest_sanctions_active_guest
  on public.community_guest_sanctions(guest_key)
  where lifted_at is null and guest_key is not null;

create unique index if not exists idx_community_guest_sanctions_active_ip
  on public.community_guest_sanctions(ip_key)
  where lifted_at is null and ip_key is not null;

alter table public.community_guest_sanctions
  drop constraint if exists community_guest_sanctions_identity_check,
  add constraint community_guest_sanctions_identity_check
    check (guest_key is not null or ip_key is not null);

alter table public.community_posts
  drop constraint if exists community_posts_guest_author_check,
  add constraint community_posts_guest_author_check check (
    (guest_key is null and guest_nickname is null and guest_ip_label is null)
    or
    (
      author_id is null
      and guest_key is not null
      and char_length(guest_key) between 32 and 128
      and char_length(guest_nickname) between 2 and 16
      and (guest_ip_label is null or char_length(guest_ip_label) between 3 and 48)
    )
  );

alter table public.community_comments
  drop constraint if exists community_comments_guest_author_check,
  add constraint community_comments_guest_author_check check (
    (guest_key is null and guest_nickname is null and guest_ip_label is null)
    or
    (
      author_id is null
      and guest_key is not null
      and char_length(guest_nickname) between 2 and 16
      and (guest_ip_label is null or char_length(guest_ip_label) between 3 and 48)
    )
  );

-- 공개 게시물/댓글에서 IP 표시를 제거한다. 이 값은 위 자격정보 테이블에 이미 이관됐다.
update public.community_posts set guest_ip_label = null where guest_ip_label is not null;
update public.community_comments set guest_ip_label = null where guest_ip_label is not null;

revoke all on table public.community_guest_post_credentials from public, anon, authenticated;
revoke all on table public.community_guest_comment_credentials from public, anon, authenticated;
revoke all on table public.community_guest_sanctions from public, anon, authenticated;
grant select, insert, update, delete on table public.community_guest_post_credentials to service_role;
grant select, insert, update, delete on table public.community_guest_comment_credentials to service_role;
grant select, insert, update, delete on table public.community_guest_sanctions to service_role;

notify pgrst, 'reload schema';
