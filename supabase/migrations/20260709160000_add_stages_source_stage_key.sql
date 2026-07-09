-- 리그피디아 동기화가 스테이지를 찾을 때 화면에 보이는 name(관리자가 자유롭게 리네임 가능)이 아니라
-- 이 안정적인 원본 키로 매칭하도록 분리한다. name만으로 매칭하면 관리자가 라운드 이름을
-- 한글로 바꾼 순간 동기화가 "새 라운드"로 오인해 중복 스테이지를 만들고 매치를 옮겨버리는
-- 문제가 있었다 (EWC 2026 브래킷 손상 사례).
alter table stages
  add column source_stage_key text;

comment on column stages.source_stage_key is
  '리그피디아 원본 Tab/Round 식별 키. 동기화 스크립트가 스테이지를 찾을 때 이 값으로 매칭하며, name(관리자가 자유롭게 수정 가능)과 분리되어 있다.';

-- 기존 행은 지금까지 리네임된 적이 없다면 name이 곧 원본 키와 같으므로 그대로 백필한다.
update stages set source_stage_key = name where source_stage_key is null;

create unique index stages_tournament_source_key_idx
  on stages(tournament_id, source_stage_key)
  where source_stage_key is not null;
