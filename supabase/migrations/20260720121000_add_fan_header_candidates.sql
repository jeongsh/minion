-- 팬페이지 헤더 유저 참여형 구조.
-- 팬이 헤더 후보 이미지를 올리고 투표하면, 매주 월요일(KST) 1위가 그 주의 헤더로 고정된다.
--
-- 소프트 삭제/블라인드는 커뮤니티(community_posts)와 같은 컨벤션을 쓴다.
-- 쓰기는 전부 service-role 경유이므로 RLS 정책은 읽기만 연다.

create table if not exists public.fan_header_candidates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- community-media 버킷 내 경로. 공개 URL은 앱에서 조립한다.
  image_path text not null,
  width integer not null,
  height integer not null,
  caption text,
  -- 캐시된 집계. 정확한 값은 fan_header_votes 이지만 목록 정렬에 매번 조인하지 않는다.
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  blinded_at timestamptz,
  -- AI 검수 결과 라벨(lib/community/moderation-labels 와 동일 어휘).
  moderation_label text
);

create table if not exists public.fan_header_votes (
  candidate_id uuid not null references public.fan_header_candidates(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (candidate_id, user_id)
);

-- 주간 선정 결과. week_start는 KST 기준 그 주 월요일.
create table if not exists public.fan_header_selections (
  team_id uuid not null references public.teams(id) on delete cascade,
  week_start date not null,
  candidate_id uuid references public.fan_header_candidates(id) on delete set null,
  vote_count integer not null default 0,
  selected_at timestamptz not null default now(),
  primary key (team_id, week_start)
);

-- 팀별 후보 목록(살아있는 것만, 득표순).
create index if not exists idx_fan_header_candidates_team
  on public.fan_header_candidates(team_id, vote_count desc, created_at desc)
  where deleted_at is null and blinded_at is null;

-- 업로드 쿼터 판정(유저별 최근 업로드).
create index if not exists idx_fan_header_candidates_user
  on public.fan_header_candidates(user_id, created_at desc);

-- 한 유저가 한 팀에 올릴 수 있는 살아있는 후보는 3개까지. 애플리케이션에서 강제하고
-- 여기서는 조회 경로만 열어둔다(부분 유니크로는 개수 제한을 표현할 수 없다).

alter table public.fan_header_candidates enable row level security;
alter table public.fan_header_votes enable row level security;
alter table public.fan_header_selections enable row level security;

grant select on public.fan_header_candidates to anon, authenticated;
grant select on public.fan_header_votes to anon, authenticated;
grant select on public.fan_header_selections to anon, authenticated;

drop policy if exists "public read fan header candidates" on public.fan_header_candidates;
create policy "public read fan header candidates" on public.fan_header_candidates
  for select using (deleted_at is null and blinded_at is null);

drop policy if exists "public read fan header votes" on public.fan_header_votes;
create policy "public read fan header votes" on public.fan_header_votes
  for select using (true);

drop policy if exists "public read fan header selections" on public.fan_header_selections;
create policy "public read fan header selections" on public.fan_header_selections
  for select using (true);

-- 투표 토글을 원자적으로 처리한다. 커뮤니티 카운터와 같은 이유로 앱에서 read-modify-write 하지 않는다.
create or replace function public.toggle_fan_header_vote(p_candidate_id uuid, p_user_id uuid)
returns table (voted boolean, vote_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted boolean;
  v_voted boolean;
  v_count integer;
begin
  select (deleted_at is not null or blinded_at is not null) into v_deleted
  from fan_header_candidates where id = p_candidate_id;

  if v_deleted is null then
    raise exception 'candidate not found';
  end if;
  if v_deleted then
    raise exception 'candidate unavailable';
  end if;

  if exists (select 1 from fan_header_votes where candidate_id = p_candidate_id and user_id = p_user_id) then
    delete from fan_header_votes where candidate_id = p_candidate_id and user_id = p_user_id;
    update fan_header_candidates
      -- RETURNS TABLE의 출력 컬럼명과 겹치므로 테이블명을 붙여 모호성을 없앤다.
      set vote_count = greatest(fan_header_candidates.vote_count - 1, 0)
      where id = p_candidate_id
      returning fan_header_candidates.vote_count into v_count;
    v_voted := false;
  else
    insert into fan_header_votes (candidate_id, user_id) values (p_candidate_id, p_user_id);
    update fan_header_candidates
      set vote_count = fan_header_candidates.vote_count + 1
      where id = p_candidate_id
      returning fan_header_candidates.vote_count into v_count;
    v_voted := true;
  end if;

  return query select v_voted, v_count;
end;
$$;

revoke all on function public.toggle_fan_header_vote(uuid, uuid) from public, anon, authenticated;
