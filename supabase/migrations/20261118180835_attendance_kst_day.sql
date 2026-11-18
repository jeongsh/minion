-- Match the web attendance day to Korean midnight, independent of DB/session timezone.
alter table public.attendance_checks
  alter column check_date set default ((now() at time zone 'Asia/Seoul')::date);
