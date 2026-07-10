-- Tipping — store tips separately from service revenue and attribute them
-- to the staff member who performed the service. `therapist_id` is added
-- here too: walk-in POS sales previously had no link to any therapist at
-- all (only booking-linked sales could reach one via bookings.therapist_id),
-- so tips (and future commission tracking) had nothing to attribute to.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tip_method TEXT CHECK (tip_method IN ('percent', 'fixed', 'custom')),
  ADD COLUMN IF NOT EXISTS therapist_id UUID REFERENCES public.therapists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_therapist ON public.sales(therapist_id);
