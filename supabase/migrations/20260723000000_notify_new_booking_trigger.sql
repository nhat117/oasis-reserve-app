-- notify-new-booking (SMS/email/push on new booking) was previously only
-- ever invoked from a client-side Supabase Realtime listener in
-- AdminDashboard.tsx — it fired only while an admin had the dashboard open
-- in a browser tab, and never at all for bookings created through the
-- public customer-facing site. This adds a DB-level trigger so every new
-- booking notifies regardless of who created it or whether anyone's
-- dashboard happens to be open, mirroring the net.http_post + vault-secret
-- pattern already used by the reminder cron jobs (20260329120000).
--
-- PREREQUISITE: same vault secret the reminder crons already require —
--   SELECT vault.create_secret('<YOUR_SERVICE_ROLE_KEY>', 'email_queue_service_role_key');

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_booking_trigger ON public.bookings;
CREATE TRIGGER notify_new_booking_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_booking();
