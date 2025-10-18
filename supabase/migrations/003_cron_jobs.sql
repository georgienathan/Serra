-- supabase/migrations/003_cron_jobs.sql
-- Setup pg_cron for automatic provider syncs

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to sync all providers every 6 hours
-- Runs at 00:00, 06:00, 12:00, 18:00 UTC
SELECT cron.schedule(
  'sync-all-wearables',           -- job name
  '0 */6 * * *',                  -- cron expression (every 6 hours)
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/_cron/sync-all-providers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Store Supabase URL and service role key as settings
-- NOTE: These need to be set manually in production
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';

-- View all cron jobs
-- SELECT * FROM cron.job;

-- Unschedule job (if needed)
-- SELECT cron.unschedule('sync-all-wearables');
