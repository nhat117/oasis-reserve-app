-- Schedule cron jobs for booking reminders (email + SMS)
-- Runs every 15 minutes to check for upcoming appointments needing reminders.
-- Uses pg_cron + pg_net to call the Supabase Edge Functions with service_role key from vault.
--
-- PREREQUISITE: The vault secret 'email_queue_service_role_key' must exist.
-- It was created by the email infra setup. If missing, run:
--   SELECT vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'email_queue_service_role_key');

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Email reminder cron: every 15 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('send-booking-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-booking-reminders',
  '*/15 * * * *',
  format(
    'SELECT net.http_post(url := %L || %L, headers := jsonb_build_object(%L, %L, %L, %L || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = %L LIMIT 1)), body := %L::jsonb);',
    'https://afibwdjbpnuxwpshsdyg.supabase.co',
    '/functions/v1/send-booking-reminders',
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ',
    'email_queue_service_role_key',
    '{}'
  )
);

-- SMS reminder cron: every 15 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('send-sms-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'send-sms-reminder',
  '*/15 * * * *',
  format(
    'SELECT net.http_post(url := %L || %L, headers := jsonb_build_object(%L, %L, %L, %L || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = %L LIMIT 1)), body := %L::jsonb);',
    'https://afibwdjbpnuxwpshsdyg.supabase.co',
    '/functions/v1/send-sms-reminder',
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ',
    'email_queue_service_role_key',
    '{}'
  )
);
