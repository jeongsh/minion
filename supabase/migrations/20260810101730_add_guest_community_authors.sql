-- 비회원 작성자는 공개 화면에 닉네임과 축약 IP만 노출한다.
-- 원문 IP는 저장하지 않고 서버 비밀키로 만든 guest_key만 차단 식별자로 사용한다.

alter table public.community_posts
  add column if not exists guest_nickname text,
  add column if not exists guest_ip_label text,
  add column if not exists guest_key text;

alter table public.community_comments
  add column if not exists guest_nickname text,
  add column if not exists guest_ip_label text,
  add column if not exists guest_key text;

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
      and char_length(guest_ip_label) between 3 and 48
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
      and char_length(guest_ip_label) between 3 and 48
    )
  );

create index if not exists idx_community_posts_guest_key
  on public.community_posts(guest_key)
  where guest_key is not null;

create index if not exists idx_community_comments_guest_key
  on public.community_comments(guest_key)
  where guest_key is not null;

-- 비밀번호 해시는 공개 글/댓글 행과 분리한다. Data API에서는 service_role만 접근한다.
create table if not exists public.community_guest_post_credentials (
  post_id uuid primary key references public.community_posts(id) on delete cascade,
  guest_key text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.community_guest_comment_credentials (
  comment_id uuid primary key references public.community_comments(id) on delete cascade,
  guest_key text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_post_credentials_key_created
  on public.community_guest_post_credentials(guest_key, created_at desc);

create index if not exists idx_guest_comment_credentials_key_created
  on public.community_guest_comment_credentials(guest_key, created_at desc);

create table if not exists public.community_guest_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  guest_key text not null,
  guest_ip_label text not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, guest_key)
);

create index if not exists idx_community_guest_blocks_guest_key
  on public.community_guest_blocks(guest_key);

create table if not exists public.community_guest_sanctions (
  id uuid primary key default gen_random_uuid(),
  guest_key text not null,
  guest_ip_label text not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  banned_by uuid not null references public.profiles(id) on delete restrict,
  banned_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id) on delete set null
);

create unique index if not exists idx_community_guest_sanctions_active
  on public.community_guest_sanctions(guest_key)
  where lifted_at is null;

alter table public.community_guest_post_credentials enable row level security;
alter table public.community_guest_comment_credentials enable row level security;
alter table public.community_guest_blocks enable row level security;
alter table public.community_guest_sanctions enable row level security;

revoke all on table public.community_guest_post_credentials from public, anon, authenticated;
revoke all on table public.community_guest_comment_credentials from public, anon, authenticated;
revoke all on table public.community_guest_sanctions from public, anon, authenticated;
grant select, insert, update, delete on table public.community_guest_post_credentials to service_role;
grant select, insert, update, delete on table public.community_guest_comment_credentials to service_role;
grant select, insert, update, delete on table public.community_guest_sanctions to service_role;

revoke all on table public.community_guest_blocks from public, anon, authenticated;
grant select, insert, delete on table public.community_guest_blocks to authenticated;
grant select, insert, update, delete on table public.community_guest_blocks to service_role;

drop policy if exists "users read own guest blocks" on public.community_guest_blocks;
create policy "users read own guest blocks"
  on public.community_guest_blocks for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "users create own guest blocks" on public.community_guest_blocks;
create policy "users create own guest blocks"
  on public.community_guest_blocks for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id);

drop policy if exists "users delete own guest blocks" on public.community_guest_blocks;
create policy "users delete own guest blocks"
  on public.community_guest_blocks for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

notify pgrst, 'reload schema';
