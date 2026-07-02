alter table public.matches
  add column if not exists lolesports_match_id text;

create unique index if not exists idx_matches_lolesports_match_id
  on public.matches(lolesports_match_id)
  where lolesports_match_id is not null;

create table if not exists public.match_automation_events (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  match_id uuid not null references public.matches(id) on delete cascade,
  set_id uuid references public.sets(id) on delete cascade,
  event_type text not null check (event_type in ('set_rating_opened', 'match_completed')),
  set_number integer,
  payload jsonb not null default '{}'::jsonb,
  delivery_attempts integer not null default 0,
  claimed_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

alter table public.match_automation_events enable row level security;

create index if not exists idx_match_automation_events_pending
  on public.match_automation_events(created_at)
  where delivered_at is null;

create index if not exists idx_match_automation_events_match_id
  on public.match_automation_events(match_id);

create index if not exists idx_match_automation_events_set_id
  on public.match_automation_events(set_id);

grant all on public.match_automation_events to service_role;

create or replace function public.reconcile_lolesports_match_score(
  p_match_id uuid,
  p_lolesports_match_id text,
  p_team_a_score integer,
  p_team_b_score integer,
  p_external_state text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_previous_total integer;
  v_new_total integer;
  v_previous_team_a_score integer;
  v_previous_team_b_score integer;
  v_team_a_delta integer;
  v_team_b_delta integer;
  v_set_winner_team_id uuid;
  v_set_number integer;
  v_set_id uuid;
  v_opened_set_numbers integer[] := '{}';
  v_match_completed boolean;
  v_previously_completed boolean;
  v_winner_team_id uuid;
begin
  if p_team_a_score < 0 or p_team_b_score < 0 then
    raise exception 'LoL Esports scores cannot be negative';
  end if;

  if p_external_state not in ('unstarted', 'inProgress', 'completed') then
    raise exception 'Unsupported LoL Esports match state: %', p_external_state;
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match % was not found', p_match_id;
  end if;

  if v_match.lolesports_match_id is not null
    and v_match.lolesports_match_id <> p_lolesports_match_id then
    raise exception 'LoL Esports match id mismatch for match %', p_match_id;
  end if;

  v_previous_team_a_score := coalesce(v_match.team_a_score, 0);
  v_previous_team_b_score := coalesce(v_match.team_b_score, 0);
  v_previous_total := v_previous_team_a_score + v_previous_team_b_score;
  v_new_total := p_team_a_score + p_team_b_score;
  v_team_a_delta := p_team_a_score - v_previous_team_a_score;
  v_team_b_delta := p_team_b_score - v_previous_team_b_score;

  if v_team_a_delta < 0 or v_team_b_delta < 0 then
    return jsonb_build_object(
      'ignored', true,
      'reason', 'score_regression',
      'openedSetNumbers', '[]'::jsonb,
      'matchCompleted', v_match.status = 'completed'
    );
  end if;

  if v_match.best_of is not null and v_new_total > v_match.best_of then
    raise exception 'LoL Esports score total % exceeds best-of %', v_new_total, v_match.best_of;
  end if;

  if v_team_a_delta > 0 and v_team_b_delta > 0 then
    raise exception 'Ambiguous multi-team score jump for match %: %:% -> %:%',
      p_match_id,
      v_previous_team_a_score,
      v_previous_team_b_score,
      p_team_a_score,
      p_team_b_score;
  end if;

  if v_new_total > v_previous_total then
    v_set_winner_team_id := case
      when v_team_a_delta > 0 then v_match.team_a_id
      else v_match.team_b_id
    end;
    if v_set_winner_team_id is null then
      raise exception 'Cannot record a set winner for match % without both local teams', p_match_id;
    end if;

    for v_set_number in (v_previous_total + 1)..v_new_total loop
      insert into public.sets (match_id, set_number, status)
      values (p_match_id, v_set_number, 'scheduled')
      on conflict (match_id, set_number) do nothing;

      update public.sets
      set status = 'finished',
          winner_team_id = coalesce(winner_team_id, v_set_winner_team_id)
      where match_id = p_match_id
        and set_number = v_set_number
        and status in ('scheduled', 'draft_in_progress', 'draft_done')
      returning id into v_set_id;

      if found then
        v_opened_set_numbers := array_append(v_opened_set_numbers, v_set_number);

        insert into public.match_automation_events (
          dedupe_key, match_id, set_id, event_type, set_number, payload
        )
        values (
          'set-rating-opened:' || p_match_id::text || ':' || v_set_number::text,
          p_match_id,
          v_set_id,
          'set_rating_opened',
          v_set_number,
          jsonb_build_object(
            'matchId', p_match_id,
            'matchName', v_match.name,
            'lolesportsMatchId', p_lolesports_match_id,
            'setNumber', v_set_number,
            'winnerTeamId', v_set_winner_team_id,
            'teamAScore', p_team_a_score,
            'teamBScore', p_team_b_score
          )
        )
        on conflict (dedupe_key) do nothing;
      end if;
    end loop;
  end if;

  v_match_completed := p_external_state = 'completed'
    or (
      v_match.best_of is not null
      and greatest(p_team_a_score, p_team_b_score) >= floor(v_match.best_of / 2.0) + 1
    );
  v_previously_completed := v_match.status = 'completed';

  if v_match_completed and p_team_a_score <> p_team_b_score then
    v_winner_team_id := case
      when p_team_a_score > p_team_b_score then v_match.team_a_id
      else v_match.team_b_id
    end;
  else
    v_winner_team_id := v_match.winner_team_id;
  end if;

  update public.matches
  set lolesports_match_id = coalesce(lolesports_match_id, p_lolesports_match_id),
      team_a_score = p_team_a_score,
      team_b_score = p_team_b_score,
      status = case
        when v_match_completed then 'completed'
        when p_external_state = 'inProgress' or v_new_total > 0 then 'live'
        else 'scheduled'
      end,
      winner_team_id = v_winner_team_id
  where id = p_match_id;

  if v_match_completed and not v_previously_completed then
    insert into public.match_automation_events (dedupe_key, match_id, event_type, payload)
    values (
      'match-completed:' || p_match_id::text,
      p_match_id,
      'match_completed',
      jsonb_build_object(
        'matchId', p_match_id,
        'matchName', v_match.name,
        'lolesportsMatchId', p_lolesports_match_id,
        'teamAScore', p_team_a_score,
        'teamBScore', p_team_b_score
      )
    )
    on conflict (dedupe_key) do nothing;
  end if;

  return jsonb_build_object(
    'ignored', false,
    'openedSetNumbers', to_jsonb(v_opened_set_numbers),
    'matchCompleted', v_match_completed
  );
end;
$$;

revoke all on function public.reconcile_lolesports_match_score(uuid, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_lolesports_match_score(uuid, text, integer, integer, text)
  to service_role;

create or replace function public.claim_match_automation_events(p_limit integer default 20)
returns setof public.match_automation_events
language sql
security definer
set search_path = ''
as $$
  update public.match_automation_events
  set claimed_at = now(),
      delivery_attempts = delivery_attempts + 1
  where id in (
    select id
    from public.match_automation_events
    where delivered_at is null
      and (claimed_at is null or claimed_at < now() - interval '5 minutes')
    order by created_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  returning *;
$$;

revoke all on function public.claim_match_automation_events(integer)
  from public, anon, authenticated;
grant execute on function public.claim_match_automation_events(integer)
  to service_role;
