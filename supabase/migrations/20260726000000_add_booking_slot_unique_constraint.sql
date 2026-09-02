-- Prevent the same therapist/slot from being double-booked or flooded with
-- duplicate inserts, regardless of what the client sends.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_duplicate_slot
  ON public.bookings (tenant_id, therapist_id, booking_date, start_time)
  WHERE status <> 'cancelled';
