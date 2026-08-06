-- Hourly evaluation of price alerts.
--
-- Until now nothing evaluated an alert on a schedule. The function existed and
-- the README described a cron, but the schedule lived only in someone's
-- intention: alerts sat pending for days, and the one that ever fired was fired
-- by hand. Committing the schedule as a migration is the point — a cron that
-- exists only in a dashboard is indistinguishable from one that does not exist
-- at all until you go looking, which is exactly what happened here.
--
-- Why hourly. Twelve Data's free tier is 800 credits a day and 8 requests a
-- minute, and the sweep costs ONE request no matter how many alerts exist,
-- because every distinct ticker goes into a single comma-separated /quote call.
-- Hourly is therefore 24 credits a day — about 3% of the budget — and leaves
-- the rest for the dashboard. Tighter intervals buy very little: an alert is a
-- "tell me when", not a trading signal, and the create-time check below already
-- covers the impatient case.
--
-- Creating an alert additionally invokes the function scoped to that one
-- ticker, so a threshold that is already met fires at once rather than looking
-- broken for up to an hour. This schedule is the guarantee; that call is the
-- courtesy, and it is allowed to fail.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-runnable. cron.schedule() on an existing jobname updates it, but being
-- explicit means the migration reads the same way whether or not it has run.
select cron.unschedule('check-price-alerts-hourly')
where exists (
  select 1 from cron.job where jobname = 'check-price-alerts-hourly'
);

-- The endpoint and the shared secret come from Vault, not from this file.
-- A migration is committed, and the whole reason the function is gated by
-- x-cron-secret is that it is deployed --no-verify-jwt and therefore reachable
-- by anyone who knows the URL. Inlining the secret here would publish the key
-- to the lock.
--
-- Set them once per project, from the SQL editor or psql:
--
--   select vault.create_secret(
--     'https://<project-ref>.supabase.co/functions/v1/check-price-alerts',
--     'alerts_endpoint');
--   select vault.create_secret('<the CRON_SECRET value>', 'cron_secret');
--
-- Rotating the secret means updating the Vault row and the function's
-- CRON_SECRET together; the job picks the new value up on its next run.
select cron.schedule(
  'check-price-alerts-hourly',
  '0 * * * *',
  $job$
  do $inner$
  declare
    v_url    text;
    v_secret text;
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'alerts_endpoint';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'cron_secret';

    -- Fail loudly rather than posting to a null URL. A missing secret would
    -- otherwise make every run a silent no-op, which looks identical to "no
    -- alerts crossed" — the failure mode this migration exists to end.
    if v_url is null or v_secret is null then
      raise exception
        'price-alert cron: vault secrets alerts_endpoint and/or cron_secret are not set';
    end if;

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', v_secret
      ),
      timeout_milliseconds := 20000
    );
  end
  $inner$;
  $job$
);

-- Verify with:
--   select jobid, jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job
--                    where jobname = 'check-price-alerts-hourly')
--    order by start_time desc limit 5;
