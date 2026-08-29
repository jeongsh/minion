-- 출석체크(attendance insert + LP 원장 + profiles.lp/tier 갱신)를 단일 트랜잭션 함수로 묶는다.
-- 기존 checkInAction / 모바일 me 라우트는 attendance insert 를 먼저 커밋한 뒤 별도로
-- recordLpEvent 를 호출했다. 후자가 실패하면 "출석은 됐는데 LP 는 안 들어온" 상태가
-- 남고(하루 1회 제약이라 재시도 불가), 유저에겐 "+100 LP" 성공 메시지가 표시됐다.
-- 이 함수는 셋을 한 트랜잭션에서 처리한다: attendance 유니크 위반이면 'already',
-- 그 외 성공이면 ledger/profile 까지 반드시 함께 반영된다.
--
-- 신원은 auth.uid()(호출자 JWT). authenticated 롤에 실행 허용(place_prediction_bet 과 동일 패턴).

set lock_timeout = '5s';

create or replace function public.check_in()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_delta constant integer := 100;
begin
  if v_user_id is null then
    return 'unauthenticated';
  end if;

  -- 프로필 행 잠금(경쟁 직렬화). 없으면 무시.
  perform 1 from public.profiles where id = v_user_id for update;
  if not found then
    return 'no_profile';
  end if;

  -- 하루 1회: (user_id, check_date) 유니크. check_date 기본값 current_date.
  begin
    insert into public.attendance_checks (user_id) values (v_user_id);
  exception when unique_violation then
    return 'already';
  end;

  -- 원장 + profiles.lp/tier 갱신은 공용 함수에 위임(공식 단일화). 같은 트랜잭션이라 원자성 유지.
  perform public.record_lp_event(v_user_id, 'attendance', v_delta);

  return 'checked_in';
end;
$$;

revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;
