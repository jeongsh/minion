-- LP 원장 기록 + profiles.lp/tier 갱신을 단일 트랜잭션 함수로 묶는다.
-- 기존에는 앱(lib/rank/record-lp.ts)이 (1) profiles select → (2) lp_ledger insert →
-- (3) profiles update 를 별도 왕복으로 처리했다. 문제:
--   * 트랜잭션이 아니라 부분 실패 시 원장 합계 ≠ profiles.lp 불일치.
--   * nextLp 를 앱에서 읽은 값으로 계산해, 동시 LP 이벤트가 서로의 delta 를 덮어씀.
-- 이 함수는 프로필 행을 잠그고 `lp + delta` 로 원자적으로 갱신한다.
-- tier 는 기존 tier_for_sp(bigint) 재사용(챌린저 cap 은 ranked_profiles 뷰에서 별도 계산).
-- 서비스 롤로만 호출한다(호출부: recordLpEvent, admin 클라이언트).

set lock_timeout = '5s';

create or replace function public.record_lp_event(
  p_user_id uuid,
  p_reason text,
  p_delta integer,
  p_post_id uuid default null,
  p_comment_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_delta is null or p_reason is null then
    return;
  end if;

  -- 프로필이 없으면 조용히 무시(기존 recordLpEvent 동작 유지). 행 잠금으로 경쟁 직렬화.
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    return;
  end if;

  insert into public.lp_ledger (user_id, reason, delta, post_id, comment_id)
  values (p_user_id, p_reason, p_delta, p_post_id, p_comment_id);

  -- MIN_LP = 0 (lib/rank/config.ts). 앱 계산값이 아니라 현재 행 값 기준 lp + delta 로 원자 갱신.
  -- 단일 UPDATE 안에서 우변의 lp 는 갱신 전 값이므로 greatest(...) 는 동일하게 두 번 평가된다.
  update public.profiles
  set lp = greatest(0, lp + p_delta),
      tier = public.tier_for_sp(greatest(0, lp + p_delta))
  where id = p_user_id;
end;
$$;

revoke all on function public.record_lp_event(uuid, text, integer, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_lp_event(uuid, text, integer, uuid, uuid) to service_role;
