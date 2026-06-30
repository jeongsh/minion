-- =============================================================================
-- 인증 프로필 + 랭크(LP/티어) 시스템
-- profiles, lp_ledger, attendance_checks 테이블 + RLS/인덱스/함수.
-- 티어: iron/bronze/silver/gold/platinum/emerald/diamond/master/grandmaster/challenger
-- challenger는 grandmaster 임계 이상 사용자 중 LP 상위 50명만(뷰에서 계산).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles: auth.users 1:1, 닉네임/티어/LP 보관. 가입 시작 등급은 bronze.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  tier text not null default 'bronze',
  lp integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_lp on public.profiles(lp desc);
create index if not exists idx_profiles_tier on public.profiles(tier);

-- -----------------------------------------------------------------------------
-- lp_ledger: LP 가감 원장(누가/왜/얼마/관련 글·댓글).
-- -----------------------------------------------------------------------------
create table if not exists public.lp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  delta integer not null,
  post_id uuid,
  comment_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_lp_ledger_user_id on public.lp_ledger(user_id);
create index if not exists idx_lp_ledger_created_at on public.lp_ledger(created_at desc);

-- -----------------------------------------------------------------------------
-- attendance_checks: 출석체크. (user_id, check_date) unique 로 하루 1회 제한.
-- -----------------------------------------------------------------------------
create table if not exists public.attendance_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, check_date)
);

create index if not exists idx_attendance_checks_user_id on public.attendance_checks(user_id);

-- -----------------------------------------------------------------------------
-- 회원가입 시 profiles 자동 생성 트리거.
-- nickname 은 가입 메타데이터(raw_user_meta_data->>'nickname')에서 가져오고,
-- 없으면 이메일 local-part로 폴백. 가입 등급은 bronze, lp 0.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nickname text;
begin
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    split_part(new.email, '@', 1)
  );

  -- 닉네임 충돌 시 짧은 suffix를 붙여 unique 보장.
  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := v_nickname || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 0)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 트리거 전용 함수는 클라이언트(RPC)에서 직접 호출되지 않도록 EXECUTE 권한 회수.
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- 랭킹 뷰: 챌린저 50명 cap 을 반영해 effective_tier 를 계산.
-- grandmaster 임계(3200) 이상 사용자 중 LP 내림차순 상위 50명 = challenger,
-- 그 외 grandmaster 이상은 grandmaster, 나머지는 저장된 tier 유지.
-- profiles.tier 컬럼은 "기본 티어"(bronze~grandmaster)를 저장하고,
-- challenger 승격은 읽기 시 이 뷰에서 동적으로 결정한다.
-- -----------------------------------------------------------------------------
create or replace view public.ranked_profiles
with (security_invoker = on)
as
with gm as (
  select
    id,
    row_number() over (order by lp desc, created_at asc) as gm_rank
  from public.profiles
  where lp >= 3200
)
select
  p.id,
  p.nickname,
  p.lp,
  p.created_at,
  p.tier as base_tier,
  case
    when gm.gm_rank is not null and gm.gm_rank <= 50 then 'challenger'
    else p.tier
  end as effective_tier,
  rank() over (order by p.lp desc) as overall_rank
from public.profiles p
left join gm on gm.id = p.id;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.lp_ledger enable row level security;
alter table public.attendance_checks enable row level security;

-- profiles: 닉네임/티어 공개 read, 본인만 update.
drop policy if exists "public read profiles" on public.profiles;
create policy "public read profiles" on public.profiles
  for select using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- lp_ledger: 공개 read(랭킹/타인 프로필 노출용), insert는 서버(service role)만.
drop policy if exists "public read lp ledger" on public.lp_ledger;
create policy "public read lp ledger" on public.lp_ledger
  for select using (true);

-- attendance_checks: 본인만 read/insert.
drop policy if exists "users read own attendance" on public.attendance_checks;
create policy "users read own attendance" on public.attendance_checks
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "users insert own attendance" on public.attendance_checks;
create policy "users insert own attendance" on public.attendance_checks
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- =============================================================================
-- GRANT
-- =============================================================================
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant select on public.lp_ledger to anon, authenticated;
grant select, insert on public.attendance_checks to authenticated;
grant select on public.ranked_profiles to anon, authenticated;
