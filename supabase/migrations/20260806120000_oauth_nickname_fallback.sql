-- =============================================================================
-- 소셜 로그인(구글/카카오/네이버) 도입에 따른 handle_new_user() 닉네임 폴백 보강.
-- 기존엔 raw_user_meta_data->>'nickname' 이 없으면 곧장 이메일 local-part로
-- 폴백했는데, 카카오/네이버는 이메일 제공 동의를 거부할 수 있어 email 이 null인
-- 채로 가입될 수 있다. 이 경우 split_part(null, ...) 도 null 이라 nickname
-- not null 제약에 걸려 가입 자체가 실패한다. provider 가 넘겨주는 이름 계열
-- 클레임(name/full_name/user_name)을 추가로 시도하고, 그마저 없으면 user_<id>로
-- 폴백해 어떤 경우에도 가입이 실패하지 않게 한다.
-- =============================================================================

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
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), ''),
    'user_' || substr(new.id::text, 1, 8)
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
