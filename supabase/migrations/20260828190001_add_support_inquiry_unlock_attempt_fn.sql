-- 잠금 해제 시도 기록을 원자적으로 처리한다. supabase-js의 update()는 "attempts + 1" 같은
-- 계산식을 못 넘기므로, 커뮤니티 카운터(add_atomic_post_view_increment 등)와 같은 이유로
-- 앱에서 read-modify-write 하지 않고 함수 하나로 묶는다.
create or replace function public.register_support_unlock_attempt(
  p_inquiry_id uuid,
  p_success boolean,
  p_max_attempts integer default 8,
  p_lock_minutes integer default 10
)
returns table (attempts integer, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
  v_locked_until timestamptz;
begin
  if p_success then
    update support_inquiries
      set unlock_attempts = 0, unlock_locked_until = null
      where id = p_inquiry_id
      returning support_inquiries.unlock_attempts, support_inquiries.unlock_locked_until
      into v_attempts, v_locked_until;
  else
    update support_inquiries
      set unlock_attempts = support_inquiries.unlock_attempts + 1,
          unlock_locked_until = case
            when support_inquiries.unlock_attempts + 1 >= p_max_attempts
              then now() + make_interval(mins => p_lock_minutes)
            else support_inquiries.unlock_locked_until
          end
      where id = p_inquiry_id
      returning support_inquiries.unlock_attempts, support_inquiries.unlock_locked_until
      into v_attempts, v_locked_until;
  end if;

  return query select v_attempts, v_locked_until;
end;
$$;

revoke all on function public.register_support_unlock_attempt(uuid, boolean, integer, integer) from public, anon, authenticated;
