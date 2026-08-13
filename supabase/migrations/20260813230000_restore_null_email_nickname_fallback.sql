-- 20260810160000이 닉네임 충돌 재시도 로직을 고치면서, 그보다 먼저 들어가 있던
-- 20260806120000의 "이메일 null-safe 폴백"(카카오/네이버가 이메일 동의를 거부해
-- email이 null인 채로 가입되는 경우 대응)을 실수로 되돌렸다. split_part(new.email, ...)이
-- email이 null이면 그대로 null을 반환해 nickname not null 제약에 걸려 가입 자체가
-- 실패한다. 두 수정을 합쳐서 복원한다: 여러 클레임을 null-safe하게 순서대로 시도하고,
-- 충돌 시 최대 20번까지 재시도하며, 그래도 안 되면 UUID로 최종 폴백한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_nickname text;
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

  -- 20번 재시도까지 전부 겹친 경우(사실상 불가능한 확률)의 최후 폴백 — UUID는
  -- auth.users의 기본키라 항상 유일하므로 여기서는 절대 충돌하지 않는다.
  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := new.id::text;
  end if;

  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 0)
  on conflict (id) do nothing;

  return new;
end;
$$;
