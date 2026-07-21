-- 게시글 본문에 넣는 투표 블록.
-- 투표 정의(질문·선택지)는 TipTap 노드 속성으로 본문 JSON 안에 살고, 여기에는 응답만 저장한다.
-- 그래서 poll_id/option_id는 클라이언트가 삽입 시점에 만든 uuid이고 FK가 없다.
-- 선택지 라벨을 나중에 고쳐도 option_id가 유지되면 표는 그대로 따라간다.

create table if not exists public.post_poll_votes (
  poll_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 단일선택: 한 투표당 한 계정 한 표. 재투표는 option_id를 덮어쓴다.
  primary key (poll_id, user_id)
);

-- 집계는 항상 poll_id 단위로 읽는다.
create index if not exists idx_post_poll_votes_poll
  on public.post_poll_votes(poll_id, option_id);

alter table public.post_poll_votes enable row level security;
grant select on public.post_poll_votes to anon, authenticated;

-- 집계는 공개(누가 뭘 골랐는지도 조회 가능하다는 점은 감안). 쓰기는 service-role 경유.
drop policy if exists "public read post poll votes" on public.post_poll_votes;
create policy "public read post poll votes" on public.post_poll_votes
  for select using (true);
