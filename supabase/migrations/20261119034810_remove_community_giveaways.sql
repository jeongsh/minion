set lock_timeout = '5s';

drop trigger protect_community_event_fields on public.community_posts;
drop function public.protect_community_event_fields();
drop function public.mutate_community_event(uuid, uuid, boolean);

-- Remove the retired block from existing posts while preserving other nodes in order.
with documents as materialized (
  select id, case when content is json object then content::jsonb end as body
  from public.community_posts
  where event_winner_count is not null
), cleaned as (
  select id, jsonb_set(body, '{content}', (
    select coalesce(
      jsonb_agg(node order by position),
      '[{"type":"paragraph"}]'::jsonb
    )
    from jsonb_array_elements(body->'content') with ordinality as nodes(node, position)
    where node->>'type' is distinct from 'event'
  )) as body
  from documents
  where body->>'type' = 'doc'
    and jsonb_typeof(body->'content') = 'array'
    and jsonb_path_exists(body, '$.content[*] ? (@.type == "event")')
)
update public.community_posts as posts
set content = cleaned.body::text
from cleaned
where posts.id = cleaned.id;

delete from public.community_notifications where kind = 'event_winner';
alter table public.community_notifications
  drop constraint community_notifications_kind_check,
  add constraint community_notifications_kind_check
    check (kind in ('post_comment', 'comment_reply', 'admin_report', 'admin_block', 'prediction_result'));

drop table public.community_event_entries;
alter table public.community_posts
  drop column event_winner_count,
  drop column event_drawn_at;

notify pgrst, 'reload schema';
