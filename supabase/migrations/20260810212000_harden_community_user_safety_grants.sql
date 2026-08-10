revoke all on table public.community_user_blocks from anon, authenticated;
grant select, insert, delete on table public.community_user_blocks to authenticated;

revoke all on table public.community_user_reports from anon, authenticated;
grant select, insert on table public.community_user_reports to authenticated;

revoke all on table public.community_user_sanctions from anon, authenticated;
