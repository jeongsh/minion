begin;

select plan(24);

select has_table(
  'public',
  'fan_calendar_event_submissions',
  'fan calendar submission queue exists'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.fan_calendar_event_submissions'::regclass
  ),
  'submission queue has RLS enabled'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'fan_calendar_event_submissions'
  ),
  'submission queue exposes no client row policies'
);

select ok(
  not has_table_privilege('anon', 'public.fan_calendar_event_submissions', 'select,insert,update,delete'),
  'anon has no submission queue privileges'
);

select ok(
  not has_table_privilege('authenticated', 'public.fan_calendar_event_submissions', 'select,insert,update,delete'),
  'authenticated has no direct submission queue privileges'
);

select ok(
  has_table_privilege('service_role', 'public.fan_calendar_event_submissions', 'select')
  and has_table_privilege('service_role', 'public.fan_calendar_event_submissions', 'insert')
  and has_table_privilege('service_role', 'public.fan_calendar_event_submissions', 'update')
  and has_table_privilege('service_role', 'public.fan_calendar_event_submissions', 'delete'),
  'service role can operate the private submission queue'
);

select ok(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.fan_calendar_events'::regclass
  ),
  'public calendar events keep RLS enabled'
);

select ok(
  exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'fan_calendar_events'
      and policyname = 'public read fan calendar events'
      and cmd = 'SELECT'
      and roles @> array['anon', 'authenticated']::name[]
  ),
  'published calendar events have an explicit public read policy'
);

select ok(
  has_table_privilege('anon', 'public.fan_calendar_events', 'select'),
  'anon can read published calendar events'
);

select ok(
  not has_table_privilege('anon', 'public.fan_calendar_events', 'insert,update,delete'),
  'anon cannot write published calendar events'
);

select ok(
  has_table_privilege('authenticated', 'public.fan_calendar_events', 'select'),
  'authenticated can read published calendar events'
);

select ok(
  not has_table_privilege('authenticated', 'public.fan_calendar_events', 'insert,update,delete'),
  'authenticated cannot write published calendar events'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.submit_fan_calendar_event_submission(uuid,uuid,text,text,date,time without time zone,boolean,text,text)',
    'execute'
  ),
  'anon cannot execute the submission function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_fan_calendar_event_submission(uuid,uuid,text,text,date,time without time zone,boolean,text,text)',
    'execute'
  ),
  'authenticated cannot execute the submission function directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.submit_fan_calendar_event_submission(uuid,uuid,text,text,date,time without time zone,boolean,text,text)',
    'execute'
  ),
  'service role can execute the submission function'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.approve_fan_calendar_event_submission(uuid,uuid,text)',
    'execute'
  ),
  'anon cannot execute the approval function'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.approve_fan_calendar_event_submission(uuid,uuid,text)',
    'execute'
  ),
  'authenticated cannot execute the approval function directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.approve_fan_calendar_event_submission(uuid,uuid,text)',
    'execute'
  ),
  'service role can execute the atomic approval function'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.is_public_fan_calendar_source_url(text)',
    'execute'
  ),
  'anon cannot execute the calendar source URL validator'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.is_public_fan_calendar_source_url(text)',
    'execute'
  ),
  'authenticated cannot execute the calendar source URL validator'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.is_public_fan_calendar_source_url(text)',
    'execute'
  ),
  'service role can execute the calendar source URL validator'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_fan_calendar_submission_notifications(integer)',
    'execute'
  ),
  'anon cannot claim calendar notification retries'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_fan_calendar_submission_notifications(integer)',
    'execute'
  ),
  'authenticated cannot claim calendar notification retries'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_fan_calendar_submission_notifications(integer)',
    'execute'
  ),
  'service role can claim calendar notification retries'
);

select * from finish();
rollback;
