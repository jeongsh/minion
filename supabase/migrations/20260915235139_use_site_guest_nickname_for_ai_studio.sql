do $$
declare
  constraint_name text;
  studio_key text;
  normalized text;
  first_byte integer;
  suffix_bytes bytea;
  suffix_number integer;
  public_nickname text;
  prefixes constant text[] := array[
    '꾸벅조는','총총걷는','뒤뚱대는','간식찾는','몰래쉬는','딴짓하는','눈치보는','춤추는',
    '신난','삐진','겁먹은','배고픈','멍때리는','수풀숨은','강구경온','바론구경온',
    '길을잃은','집에가고픈','무리놓친','늦잠잔','혼자남은','뒤처진','한대남은','귀환못한',
    '퇴근못한','살고싶은','정글에버려진','미드에서헤맨','집앞까지온','넥서스처음본','마지막까지남은','아무도안잡는',
    '막타훔친','막타버틴','CS다먹은','귀환끊은','길막하는','어그로끈','라인밀어버린','라인얼려버린',
    '경험치먹는','킬먹고간','펜타뺏은','점멸뺀','스킬피한','논타겟막은','그랩막아선','승급전망친',
    '바론버프받은','장로버프받은','용막타친','바론막타친','정글마실간','탑끝까지민','미드달리는','백도어하는',
    '다이브한','포탑치는','포탑맞는','억제기앞에선','넥서스치는','서렌반대한','와드인척한','캐리중인'
  ];
begin
  select guest_key into studio_key
  from public.community_ai_studio_settings
  where singleton and guest_key is not null;

  if studio_key is not null then
    normalized := regexp_replace(studio_key, '[^a-f0-9]', '', 'gi') || repeat('0', 10);
    first_byte := get_byte(decode(substr(normalized, 1, 2), 'hex'), 0);
    suffix_bytes := decode(substr(normalized, 5, 6), 'hex');
    suffix_number := get_byte(suffix_bytes, 0) * 65536 + get_byte(suffix_bytes, 1) * 256 + get_byte(suffix_bytes, 2);
    public_nickname := prefixes[(first_byte % array_length(prefixes, 1)) + 1]
      || '미니언' || lpad((suffix_number % 10000)::text, 4, '0');

    update public.community_ai_studio_queue
    set guest_nickname = public_nickname
    where guest_key = studio_key and guest_nickname = '비로그인 유저';

    update public.community_posts
    set guest_nickname = public_nickname
    where guest_key = studio_key and guest_nickname = '비로그인 유저';

    update public.community_comments
    set guest_nickname = public_nickname
    where guest_key = studio_key and guest_nickname = '비로그인 유저';
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.community_ai_studio_queue'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%guest_nickname%비로그인 유저%'
  loop
    execute format('alter table public.community_ai_studio_queue drop constraint %I', constraint_name);
  end loop;

  alter table public.community_ai_studio_queue
    add constraint community_ai_studio_queue_author_shape_check
    check (
      (author_id is not null and guest_key is null and guest_nickname is null)
      or
      (author_id is null and guest_key is not null and char_length(guest_nickname) between 2 and 16)
    );
end $$;
