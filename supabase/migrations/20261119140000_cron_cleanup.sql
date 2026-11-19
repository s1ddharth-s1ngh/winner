-- Keep the free-tier database small: pg_cron logs every run forever, so drop run logs older than 7 days.
-- net._http_response needs nothing: pg_net already deletes responses after its own TTL (6 hours by default).
create extension if not exists pg_cron;

select cron.schedule('cron-log-cleanup', '0 4 * * *', $$
  delete from cron.job_run_details where end_time < now() - interval '7 days'
$$);
