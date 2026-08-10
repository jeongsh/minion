-- 닉네임 최대 길이를 10자로 낮추면서, 가입 시 자동 생성되는 닉네임(이메일 local-part
-- 폴백)도 같은 제한을 지키도록 트리거를 맞춘다. 충돌 시 붙이는 접미사(_ + 6자)까지
-- 합쳐도 항상 10자 이내가 되도록 base를 3자로 자른다.
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
    split_part(new.email, '@', 1)
  );
  v_nickname := substr(v_nickname, 1, 10);

  -- 닉네임 충돌 시 짧은 suffix를 붙여 unique 보장(10자 제한을 넘지 않도록 base를 줄인다).
  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := substr(v_nickname, 1, 3) || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 0)
  on conflict (id) do nothing;

  return new;
end;
$$;
