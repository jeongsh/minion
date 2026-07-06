alter table public.community_comments
  add column if not exists parent_id uuid references public.community_comments(id) on delete cascade;

create index if not exists idx_community_comments_parent_id
  on public.community_comments(parent_id);
