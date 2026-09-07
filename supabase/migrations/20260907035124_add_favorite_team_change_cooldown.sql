alter table public.profiles
  add column if not exists favorite_team_change_available_at timestamptz;

comment on column public.profiles.favorite_team_change_available_at is
  '최애팀을 다시 설정, 교체 또는 해제할 수 있는 시각. 최애팀 값이 바뀔 때마다 7일 뒤로 갱신된다.';

create or replace function public.enforce_favorite_team_change_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.favorite_team_id is not distinct from old.favorite_team_id then
    -- Data API 사용자가 잠금 시각만 임의로 변경해 제한을 우회하지 못하게 한다.
    new.favorite_team_change_available_at := old.favorite_team_change_available_at;
    return new;
  end if;

  -- 참조된 팀 자체가 삭제되어 ON DELETE SET NULL이 실행되는 경우는 사용자 변경이 아니다.
  if new.favorite_team_id is null
    and old.favorite_team_id is not null
    and not exists (select 1 from public.teams where id = old.favorite_team_id)
  then
    new.favorite_team_change_available_at := null;
    return new;
  end if;

  if old.favorite_team_change_available_at is not null
    and old.favorite_team_change_available_at > statement_timestamp()
  then
    raise exception using
      errcode = 'P0001',
      message = 'FAVORITE_TEAM_CHANGE_COOLDOWN',
      detail = to_char(
        old.favorite_team_change_available_at at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      );
  end if;

  new.favorite_team_change_available_at := statement_timestamp() + interval '7 days';
  return new;
end;
$$;

revoke all on function public.enforce_favorite_team_change_cooldown() from public, anon, authenticated;

drop trigger if exists enforce_favorite_team_change_cooldown on public.profiles;
create trigger enforce_favorite_team_change_cooldown
before update on public.profiles
for each row execute function public.enforce_favorite_team_change_cooldown();
