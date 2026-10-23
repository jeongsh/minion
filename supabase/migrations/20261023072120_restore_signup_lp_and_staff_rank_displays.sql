set lock_timeout = '5s';

-- Keep signup and recovery mutually exclusive while replacing the trigger.
lock table public.profiles in share row exclusive mode;
lock table public.lp_ledger in share row exclusive mode;

create unique index lp_ledger_signup_grant_once
on public.lp_ledger (user_id)
where reason in ('signup_lp_grant', 'signup_lp_recovery');

alter table public.profiles alter column lp set default 10000;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_nickname text;
  v_profile_id uuid;
  i int;
begin
  v_base := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'user_' || substr(new.id::text, 1, 8)
  );
  v_base := substr(v_base, 1, 10);
  v_nickname := v_base;

  for i in 1..20 loop
    exit when not exists (select 1 from public.profiles where nickname = v_nickname);
    v_nickname := substr(v_base, 1, 3) || '_' || substr(md5(new.id::text || i::text), 1, 6);
  end loop;

  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := new.id::text;
  end if;

  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 10000)
  on conflict (id) do nothing
  returning id into v_profile_id;

  if v_profile_id is not null then
    insert into public.lp_ledger (user_id, reason, delta)
    values (v_profile_id, 'signup_lp_grant', 10000);
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- The first bad signup trigger was deployed at 20260806130354.
-- Restore the missing grant, preserving all activity and prediction gains/losses.
-- New signups record signup_lp_grant, making this recovery safe to repeat.
with grants as (
  insert into public.lp_ledger (user_id, reason, delta)
  select p.id, 'signup_lp_recovery', 10000
  from public.profiles p
  where p.created_at >= timestamptz '2026-08-06 13:03:54+00'
    and not exists (
      select 1 from public.lp_ledger l
      where l.user_id = p.id
        and l.reason in ('base_lp_grant', 'signup_lp_grant', 'signup_lp_recovery')
    )
  on conflict (user_id) where reason in ('signup_lp_grant', 'signup_lp_recovery') do nothing
  returning user_id, delta
)
update public.profiles p
set lp = p.lp + g.delta,
    tier = public.tier_for_sp(p.lp + g.delta)
from grants g
where p.id = g.user_id;

-- Cosmetic staff membership only. This grants no application/admin privileges.
create table public.staff_rank_displays (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.staff_rank_displays enable row level security;
revoke all on public.staff_rank_displays from public, anon, authenticated;
grant select on public.staff_rank_displays to anon, authenticated;
grant all on public.staff_rank_displays to service_role;
create policy "public read staff rank displays"
on public.staff_rank_displays for select to anon, authenticated using (true);

-- Resolve once; changing or reusing a nickname cannot transfer staff appearance.
insert into public.staff_rank_displays (user_id)
select id from public.profiles where nickname in ('장로', '제우스');

create or replace view public.ranked_profiles
with (security_invoker = true)
as
with gm as (
  select p.id, row_number() over (order by p.lp desc, p.created_at asc, p.id) as gm_rank
  from public.profiles p
  where p.lp >= 320000
    and not exists (select 1 from public.staff_rank_displays s where s.user_id = p.id)
)
select
  p.id, p.nickname, p.lp, p.created_at, p.tier as base_tier,
  case
    when s.user_id is not null then 'challenger'
    when gm.gm_rank <= 50 then 'challenger'
    else p.tier
  end as effective_tier,
  rank() over (order by p.lp desc) as overall_rank
from public.profiles p
left join gm on gm.id = p.id
left join public.staff_rank_displays s on s.user_id = p.id;

grant select on public.ranked_profiles to anon, authenticated;
