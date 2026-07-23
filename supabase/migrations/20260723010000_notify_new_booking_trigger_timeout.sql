-- notify-new-booking does 2 sequential DB lookups plus SMS/email/push calls,
-- which can exceed pg_net's 5s default net.http_post timeout under load —
-- observed during rollout testing (request dispatched and DNS/TCP/SSL
-- succeeded, but Postgres gave up waiting for the response at 5019ms). That's
-- just Postgres giving up on *waiting*, not the function being interrupted,
-- but a longer timeout avoids the log noise and gives slower runs a chance to
-- still get their result recorded in net._http_response.
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://afibwdjbpnuxwpshsdyg.supabase.co/functions/v1/notify-new-booking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', NEW.id,
        'customer_name', NEW.customer_name,
        'customer_phone', NEW.customer_phone,
        'booking_date', NEW.booking_date,
        'start_time', NEW.start_time,
        'service_id', NEW.service_id,
        'therapist_id', NEW.therapist_id,
        'tenant_id', NEW.tenant_id
      )
    ),
    timeout_milliseconds := 15000
  );
  RETURN NEW;
END;
$$;
