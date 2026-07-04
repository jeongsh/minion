select cron.unschedule(jobid)
from cron.job
where jobname = 'leaguepedia-incremental-sync-daily';

drop function if exists private.invoke_leaguepedia_incremental_sync();
