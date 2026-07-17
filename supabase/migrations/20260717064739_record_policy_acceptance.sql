create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.policy_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version text not null,
  terms_accepted_at timestamptz not null,
  privacy_accepted_at timestamptz not null,
  age_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table private.policy_acceptances enable row level security;
revoke all on private.policy_acceptances from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text;
  v_policy_version text;
  v_terms_accepted boolean;
  v_privacy_accepted boolean;
  v_age_confirmed boolean;
begin
  v_nickname := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nickname'), ''),
    split_part(new.email, '@', 1)
  );

  if exists (select 1 from public.profiles where nickname = v_nickname) then
    v_nickname := v_nickname || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, nickname, tier, lp)
  values (new.id, v_nickname, 'bronze', 10000)
  on conflict (id) do nothing;

  v_policy_version := nullif(new.raw_user_meta_data->>'policy_version', '');
  v_terms_accepted := coalesce(new.raw_user_meta_data->>'terms_accepted' = 'true', false);
  v_privacy_accepted := coalesce(new.raw_user_meta_data->>'privacy_accepted' = 'true', false);
  v_age_confirmed := coalesce(new.raw_user_meta_data->>'age_confirmed' = 'true', false);

  if v_policy_version is not null and v_terms_accepted and v_privacy_accepted and v_age_confirmed then
    insert into private.policy_acceptances (
      user_id,
      policy_version,
      terms_accepted_at,
      privacy_accepted_at,
      age_confirmed
    ) values (
      new.id,
      v_policy_version,
      new.created_at,
      new.created_at,
      true
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
