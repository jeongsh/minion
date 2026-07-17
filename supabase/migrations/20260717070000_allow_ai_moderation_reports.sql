-- AI 검수 결과를 신고함(post_reports)에 같은 파이프라인으로 태운다.
-- AI 가 판단한 건은 reporter_id 없이 source='ai' 로 기록되고,
-- 기존 어드민 신고함의 제재 확정/기각 흐름을 그대로 탄다.

alter table public.post_reports
  alter column reporter_id drop not null;

alter table public.post_reports
  add column if not exists source text not null default 'user';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_reports_source_chk') then
    alter table public.post_reports
      add constraint post_reports_source_chk check (source in ('user', 'ai'));
  end if;
end $$;

-- 이용자 신고는 여전히 reporter_id 필수(AI 건만 null 허용).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'post_reports_reporter_chk') then
    alter table public.post_reports
      add constraint post_reports_reporter_chk
      check (source = 'ai' or reporter_id is not null);
  end if;
end $$;
