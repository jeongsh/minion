-- The previous preview automation migration revoked schema USAGE from authenticated
-- users, but existing RLS helpers in private still need it. Function EXECUTE grants
-- remain revoked individually.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

alter table public.match_ai_previews
  add column if not exists generation_lock_token uuid;

create table if not exists public.match_ai_preview_generation_locks (
  match_id uuid primary key references public.matches(id) on delete cascade,
  lock_token uuid not null,
  input_hash text not null,
  generation_phase text not null check (generation_phase in ('story', 'final')),
  locked_until timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.match_ai_preview_generation_locks enable row level security;
revoke all on table public.match_ai_preview_generation_locks from anon, authenticated;
grant select, insert, update, delete on table public.match_ai_preview_generation_locks to service_role;

comment on table public.match_ai_preview_generation_locks is
  'Short leases that prevent overlapping cron and manual match-preview generations.';

create or replace function public.claim_match_ai_preview_generation(
  p_match_id uuid,
  p_lock_token uuid,
  p_input_hash text,
  p_generation_phase text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed_token uuid;
begin
  if p_generation_phase not in ('story', 'final') then
    raise exception 'Invalid match preview generation phase: %', p_generation_phase;
  end if;

  insert into public.match_ai_preview_generation_locks (
    match_id,
    lock_token,
    input_hash,
    generation_phase,
    locked_until
  ) values (
    p_match_id,
    p_lock_token,
    p_input_hash,
    p_generation_phase,
    now() + interval '6 minutes'
  )
  on conflict (match_id) do update
  set lock_token = excluded.lock_token,
      input_hash = excluded.input_hash,
      generation_phase = excluded.generation_phase,
      locked_until = excluded.locked_until,
      created_at = now()
  where public.match_ai_preview_generation_locks.locked_until <= now()
  returning lock_token into v_claimed_token;

  return v_claimed_token = p_lock_token;
end;
$$;

revoke all on function public.claim_match_ai_preview_generation(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_match_ai_preview_generation(uuid, uuid, text, text)
  to service_role;

create table if not exists public.match_ai_preview_runs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  input_hash text not null,
  generation_phase text not null check (generation_phase in ('story', 'final')),
  status text not null check (status in ('running', 'success', 'research_failed', 'superseded', 'failed')),
  model text not null,
  research_model text not null,
  response_id text,
  research_response_id text,
  input_tokens bigint not null default 0,
  cached_input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  web_search_calls smallint not null default 0,
  estimated_cost_usd numeric(12, 8),
  pricing_snapshot jsonb not null default '[]'::jsonb,
  usage_complete boolean not null default false,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.match_ai_preview_runs enable row level security;
revoke all on table public.match_ai_preview_runs from anon, authenticated;
grant select, insert, update on table public.match_ai_preview_runs to service_role;

create index if not exists match_ai_preview_runs_match_started_idx
  on public.match_ai_preview_runs (match_id, started_at desc);

comment on table public.match_ai_preview_runs is
  'One row per generation attempt. Sum estimated_cost_usd by match_id for known lifecycle cost; usage_complete marks whether every API step was measured.';

create or replace view public.match_ai_preview_cost_summary
with (security_invoker = true)
as
select
  match_id,
  count(*) filter (where status <> 'running') as completed_runs,
  coalesce(sum(estimated_cost_usd), 0) as known_cost_usd,
  coalesce(
    bool_or(
      (status = 'running' and started_at <= now() - interval '6 minutes')
      or (status <> 'running' and (not usage_complete or estimated_cost_usd is null))
    ),
    false
  ) as has_incomplete_cost,
  max(completed_at) as last_completed_at
from public.match_ai_preview_runs
group by match_id;

revoke all on public.match_ai_preview_cost_summary from anon, authenticated;
grant select on public.match_ai_preview_cost_summary to service_role;

comment on view public.match_ai_preview_cost_summary is
  'Per-match lifecycle cost rollup across story, final, retry, failed, and superseded generation attempts.';

create or replace function private.guard_match_ai_preview_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.generation_phase in ('story', 'final') and not exists (
    select 1
    from public.match_ai_preview_generation_locks as generation_lock
    where generation_lock.match_id = new.match_id
      and generation_lock.lock_token = new.generation_lock_token
      and generation_lock.locked_until > now()
  ) then
    if tg_op = 'UPDATE' then
      return old;
    end if;
    return null;
  end if;

  if tg_op = 'UPDATE'
    and old.generation_phase = 'final'
    and new.generation_phase <> 'final' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_match_ai_preview_write()
  from public, anon, authenticated;

drop trigger if exists guard_match_ai_preview_write on public.match_ai_previews;
create trigger guard_match_ai_preview_write
before insert or update on public.match_ai_previews
for each row execute function private.guard_match_ai_preview_write();
