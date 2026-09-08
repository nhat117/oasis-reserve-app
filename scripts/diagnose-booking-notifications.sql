-- Why is the owner not getting the "new booking" email?
--
-- The whole notification path is fire-and-forget: the bookings AFTER INSERT
-- trigger calls notify-new-booking with net.http_post and throws the response
-- away, and the function answers 200 even when Resend rejects the message. So a
-- broken email produces no visible error anywhere in the app — these queries are
-- how you find out which link in the chain is broken.
--
-- Run in the Supabase SQL editor (Dashboard > SQL Editor) against the project the
-- app actually points at: afibwdjbpnuxwpshsdyg. Requires the postgres role, so
-- the dashboard editor, not the anon key.
--
-- Set this to the tenant you are debugging (Estique / Serene Nail Sanctuary):
--   93f1bd20-74c3-4013-b6de-d0eb8f3d56b6

-- 1. Does the trigger still exist? (Nothing recreates it except the
--    20260723000000 migration, and "Deploy Supabase" has been failing.)
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.bookings'::regclass
  AND NOT tgisinternal;
-- Expect: notify_new_booking_trigger, tgenabled = 'O' (enabled).
-- tgenabled = 'D' means someone disabled it; no row means it was never created.

-- 2. Is the service-role key the trigger authenticates with still present and
--    still valid? A rotated key leaves the secret in place but every call 401s.
SELECT name, created_at, updated_at
FROM vault.secrets
WHERE name = 'email_queue_service_role_key';
-- No row => the trigger sends "Bearer " with nothing after it and the function
-- rejects the call. Recreate with:
--   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'email_queue_service_role_key');
--
-- The value has to be byte-identical to whatever SUPABASE_SERVICE_ROLE_KEY holds
-- *inside the functions*, because send-booking-reminders and send-sms-reminder
-- compare the bearer token to it as a string. That is not necessarily the legacy
-- service_role JWT: this project was migrated to the new API key format, so the
-- env var now holds the "default" secret key (sb_secret_…) while the vault still
-- held the legacy eyJ… JWT — which is why every cron call 401'd for weeks
-- (fixed 2026-09-09). To check without printing either key, compare hashes:
--   Dashboard hash:  GET /v1/projects/<ref>/secrets → sha256 of each value
--   Stored key:      SELECT md5(decrypted_secret) FROM vault.decrypted_secrets …

-- 3. What did the function actually answer? This is the evidence the trigger
--    discards. 401 = bad/rotated vault key, 404 = function not deployed,
--    200 with "error" inside result.email = Resend refused the message.
SELECT r.id, r.status_code, r.created, left(r.content, 500) AS body
FROM net._http_response r
ORDER BY r.created DESC
LIMIT 20;
-- Nothing here at all, ever, while bookings are being created => the trigger is
-- not firing (see 1) or the pg_net background worker is not running.

-- 4. Requests that never got a response (pg_net queue backing up / worker dead).
SELECT count(*) AS queued
FROM net.http_request_queue;

-- 5. The settings the function reads. resend_api_key and resend_from_email are
--    hidden from the anon key by RLS, which is why this has to run here.
SELECT key,
       CASE WHEN key IN ('resend_api_key', 'twilio_auth_token')
            THEN CASE WHEN coalesce(value, '') = '' THEN '(empty)'
                      ELSE '(set, ' || length(value) || ' chars)' END
            ELSE value END AS value
FROM public.app_settings
WHERE tenant_id = '93f1bd20-74c3-4013-b6de-d0eb8f3d56b6'
  AND key IN ('notify_email_enabled', 'notify_email', 'resend_api_key',
              'resend_from_email', 'notify_push_enabled', 'spa_name')
ORDER BY key;
-- notify_email_enabled must be exactly the string 'true'.
-- If resend_from_email is empty the function falls back to onboarding@resend.dev,
-- which Resend only lets you mail to the Resend account owner's own address —
-- every other recipient comes back 403. Set a verified sending domain instead.

-- 6. Sanity check that bookings are still being inserted at all (if this is
--    empty the email is not the problem).
SELECT id, customer_name, booking_date, start_time, created_at
FROM public.bookings
WHERE tenant_id = '93f1bd20-74c3-4013-b6de-d0eb8f3d56b6'
ORDER BY created_at DESC
LIMIT 10;

-- Also worth checking outside SQL:
--   Dashboard > Edge Functions > notify-new-booking > Logs — after the change in
--   supabase/functions/notify-new-booking/index.ts, a refused email now logs
--   "[notify-new-booking] Resend rejected the owner email (...)" with the status
--   and Resend's reason. Redeploy the function first:
--     supabase functions deploy notify-new-booking --project-ref afibwdjbpnuxwpshsdyg
--   Resend Dashboard > Emails — shows delivered/bounced per message, and whether
--   the API key in app_settings still exists.
