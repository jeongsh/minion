-- 닉네임 충돌 시 고정된 suffix(앞3글자+UUID앞6자리) 하나만 시도하고 끝나서, 그 조합마저
-- 겹치면 unique 위반으로 가입 트랜잭션 전체가 실패하던 문제를 고친다. 최대 20번까지
-- 다른 suffix로 재시도하고, 그래도 안 되면 UUID 전체(항상 유일함)로 폴백해 가입 자체는
-- 절대 실패하지 않게 보장한다.
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
    split_part(new.email, '@', 1)
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
