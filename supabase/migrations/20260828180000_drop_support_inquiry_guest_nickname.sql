-- 비회원 닉네임을 직접 입력받는 대신, 커뮤니티와 같은 자동 생성 닉네임(guest_key 해시 기반)을
-- 그대로 쓰기로 했다. 방금 추가한 이 컬럼은 쓰이지 않으니 정리한다.
alter table public.support_inquiries
  drop column if exists guest_nickname;
