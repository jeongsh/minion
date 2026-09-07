begin;
select plan(8);

insert into public.community_posts (id, board_type, site_scope, title, content)
values (
  '11111111-1111-1111-1111-111111111111',
  'discussion',
  'hub',
  'view test',
  '{"type":"doc","content":[]}'
);

set local role service_role;

select is(
  public.increment_community_post_view_count('11111111-1111-1111-1111-111111111111', 'ip-a'),
  1,
  'first view from an IP increments count'
);

select is(
  public.increment_community_post_view_count('11111111-1111-1111-1111-111111111111', 'ip-a'),
  1,
  'repeat view from the same IP does not increment count'
);

select is(
  public.increment_community_post_view_count('11111111-1111-1111-1111-111111111111', 'ip-b'),
  2,
  'view from another IP increments count'
);

select is(
  public.increment_community_post_view_count('11111111-1111-1111-1111-111111111111', null::text),
  2,
  'missing IP key returns the current count without incrementing'
);

select results_eq(
  $$select count(*)::integer from public.community_post_views where post_id = '11111111-1111-1111-1111-111111111111'$$,
  array[2],
  'only unique post/IP pairs are recorded'
);

reset role;

select ok(
  not has_function_privilege('anon', 'public.increment_community_post_view_count(uuid,text)', 'execute'),
  'anon cannot execute the view increment function'
);

select ok(
  not has_function_privilege('authenticated', 'public.increment_community_post_view_count(uuid,text)', 'execute'),
  'authenticated cannot execute the view increment function'
);

select ok(
  not has_table_privilege('anon', 'public.community_post_views', 'insert,update,delete'),
  'anon has no write grant on post view records'
);

select * from finish();
rollback;
