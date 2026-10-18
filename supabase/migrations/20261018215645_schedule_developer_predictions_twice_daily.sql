-- UTC 03:05 and 15:05 are 12:05 and 00:05 in Asia/Seoul.
do $$
declare
  v_command text;
begin
  select command into strict v_command from cron.job
  where jobname = 'developer-predictions-every-fifteen-minutes';
  perform cron.unschedule('developer-predictions-every-fifteen-minutes');
  perform cron.schedule('developer-predictions-twice-daily', '5 3,15 * * *', v_command);
end;
$$;

select cron.schedule(
  'cleanup-developer-prediction-cron-history', '47 3 * * *',
  $cron$
    delete from cron.job_run_details where jobid in (
      select jobid from cron.job where jobname = 'developer-predictions-twice-daily'
    ) and end_time < now() - interval '7 days';
  $cron$
);
