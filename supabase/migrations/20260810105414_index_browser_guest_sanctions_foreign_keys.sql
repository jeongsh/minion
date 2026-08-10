create index if not exists idx_community_guest_sanctions_banned_by
  on public.community_guest_sanctions(banned_by);

create index if not exists idx_community_guest_sanctions_lifted_by
  on public.community_guest_sanctions(lifted_by)
  where lifted_by is not null;
