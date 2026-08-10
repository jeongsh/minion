revoke all on table public.community_guest_blocks from public, anon, authenticated;
grant select, insert, delete on table public.community_guest_blocks to authenticated;
grant select, insert, update, delete on table public.community_guest_blocks to service_role;

notify pgrst, 'reload schema';
