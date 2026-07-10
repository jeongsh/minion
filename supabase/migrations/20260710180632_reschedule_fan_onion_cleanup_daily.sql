do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-fan-onions') then
    perform cron.unschedule('cleanup-expired-fan-onions');
  end if;
end $$;

select cron.schedule(
  'cleanup-expired-fan-onions',
  '17 3 * * *',
  $$select public.cleanup_expired_fan_onions();$$
);
