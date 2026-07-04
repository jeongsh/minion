-- 대회 하나의 대진표를 "브래킷 스테이지"(예: 플레이-인 / 토너먼트 스테이지) 단위로 나눠
-- 관리자 화면과 공개 페이지에서 탭으로 전환해 볼 수 있게 한다.
create table bracket_stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create index bracket_stages_tournament_id_idx on bracket_stages(tournament_id);

alter table bracket_stages enable row level security;

create policy "public read bracket_stages" on bracket_stages
  for select using (true);

alter table stages
  add column bracket_stage_id uuid references bracket_stages(id) on delete set null;

-- 기존 대회는 라운드가 있던 대회마다 기본 브래킷 스테이지를 하나 만들어 그 안에 있던
-- 라운드를 전부 옮겨준다. 관리자가 나중에 이름을 바꾸거나 브래킷 스테이지를 더 추가할 수 있다.
insert into bracket_stages (tournament_id, name, order_index)
select distinct tournament_id, '메인 브래킷', 0
from stages;

update stages s
set bracket_stage_id = bs.id
from bracket_stages bs
where bs.tournament_id = s.tournament_id;

alter table stages
  alter column bracket_stage_id set not null;

create index stages_bracket_stage_id_idx on stages(bracket_stage_id);
