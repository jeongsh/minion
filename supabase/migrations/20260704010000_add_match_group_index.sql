-- 한 라운드(스테이지) 안에 서로 독립적인 여러 그룹(각자 자체 승자조/패자조 진행)이
-- 동시에 존재할 수 있는 대진표를 표현하기 위해, 매치별로 소속 그룹을 표시한다.
-- 기본값 0이라 기존 대진표는 전부 그룹 0 하나로 처리되어 지금과 동일하게 보인다.
alter table matches
  add column group_index integer not null default 0;
