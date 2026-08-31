create table public.minicon_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  creator_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft',
  cover_url text not null,
  is_official boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint minicon_packs_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint minicon_packs_name_check check (char_length(name) between 1 and 30),
  constraint minicon_packs_description_check check (char_length(description) <= 300),
  constraint minicon_packs_status_check check (
    status in ('draft', 'pending_review', 'published', 'rejected', 'retired', 'suspended')
  )
);

create table public.minicon_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.minicon_packs(id) on delete cascade,
  name text not null,
  image_url text not null,
  storage_path text,
  mime_type text not null,
  byte_size integer not null default 0,
  width integer not null default 200,
  height integer not null default 200,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint minicon_items_name_check check (char_length(name) between 1 and 20),
  constraint minicon_items_image_url_check check (char_length(image_url) between 1 and 2048),
  constraint minicon_items_mime_type_check check (mime_type in ('image/png', 'image/jpeg', 'image/gif')),
  constraint minicon_items_byte_size_check check (byte_size between 0 and 2097152),
  constraint minicon_items_dimensions_check check (width = 200 and height = 200),
  constraint minicon_items_sort_order_check check (sort_order between 0 and 199),
  unique (pack_id, sort_order)
);

create index minicon_packs_catalog_idx
  on public.minicon_packs(status, is_official desc, sort_order, published_at desc);

create index minicon_items_pack_active_idx
  on public.minicon_items(pack_id, is_active, sort_order);

alter table public.minicon_packs enable row level security;
alter table public.minicon_items enable row level security;

revoke all on table public.minicon_packs from anon, authenticated;
revoke all on table public.minicon_items from anon, authenticated;
grant select on table public.minicon_packs to anon, authenticated;
grant select on table public.minicon_items to anon, authenticated;
grant all on table public.minicon_packs to service_role;
grant all on table public.minicon_items to service_role;

create policy "public read published minicon packs"
  on public.minicon_packs for select
  to anon, authenticated
  using (status = 'published');

create policy "public read published minicon items"
  on public.minicon_items for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.minicon_packs pack
      where pack.id = minicon_items.pack_id
        and pack.status = 'published'
    )
  );

alter table public.community_comments
  add column content_kind text not null default 'text',
  add column minicon_item_id uuid references public.minicon_items(id) on delete restrict;

alter table public.community_comments
  add constraint community_comments_content_kind_check
    check (content_kind in ('text', 'minicon')),
  add constraint community_comments_minicon_shape_check
    check (
      (content_kind = 'text' and minicon_item_id is null)
      or
      (content_kind = 'minicon' and minicon_item_id is not null and content = '[미니콘]')
    );

create index community_comments_minicon_item_idx
  on public.community_comments(minicon_item_id)
  where minicon_item_id is not null;

drop policy if exists "authenticated insert community comments" on public.community_comments;
create policy "authenticated insert community comments"
  on public.community_comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and minicon_item_id is null
    and not (select private.current_user_is_community_sanctioned())
  );

drop policy if exists "authors update community comments" on public.community_comments;
create policy "authors update community comments"
  on public.community_comments for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and not (select private.current_user_is_community_sanctioned())
  )
  with check (
    (select auth.uid()) = author_id
    and content_kind = 'text'
    and minicon_item_id is null
    and not (select private.current_user_is_community_sanctioned())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'minicons',
  'minicons',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.minicon_packs (
  slug,
  name,
  description,
  status,
  cover_url,
  is_official,
  sort_order,
  published_at
)
values (
  'minion-starter',
  '미니콘 스타터',
  'MINION 커뮤니티에서 바로 사용할 수 있는 기본 미니콘입니다.',
  'published',
  '/minicons/minion-starter/01-good.png',
  true,
  0,
  now()
)
on conflict (slug) do nothing;

insert into public.minicon_items (pack_id, name, image_url, mime_type, sort_order)
select pack.id, item.name, item.image_url, 'image/png', item.sort_order
from public.minicon_packs pack
cross join (
  values
    ('좋아', '/minicons/minion-starter/01-good.png', 0),
    ('가자', '/minicons/minion-starter/02-go.png', 1),
    ('인정', '/minicons/minion-starter/03-agree.png', 2),
    ('대박', '/minicons/minion-starter/04-wow.png', 3),
    ('아쉽', '/minicons/minion-starter/05-close.png', 4),
    ('수고', '/minicons/minion-starter/06-good-game.png', 5),
    ('ㅋㅋ', '/minicons/minion-starter/07-lol.png', 6),
    ('집중', '/minicons/minion-starter/08-focus.png', 7),
    ('승리', '/minicons/minion-starter/09-win.png', 8),
    ('파이팅', '/minicons/minion-starter/10-fighting.png', 9)
) as item(name, image_url, sort_order)
where pack.slug = 'minion-starter'
on conflict (pack_id, sort_order) do nothing;

comment on table public.minicon_packs is '미니콘 패키지와 공개·심사 상태';
comment on table public.minicon_items is '200x200 JPG/PNG/GIF 미니콘 원본 메타데이터';
comment on column public.community_comments.content_kind is 'text 또는 minicon 댓글 구분';
comment on column public.community_comments.minicon_item_id is '미니콘 댓글이 표시하는 불변 아이템';
