-- Add payment tracking columns to bookings and sales tables
-- Supports Stripe (online checkout) and Square (physical terminal)

-- Bookings: track payment status for online payments
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS payment_provider text
    CHECK (payment_provider IN ('stripe', 'square', NULL)),
  ADD COLUMN IF NOT EXISTS payment_intent_id text,
  ADD COLUMN IF NOT EXISTS total_amount numeric;

-- Sales: track which payment provider processed the transaction
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_provider text
    CHECK (payment_provider IN ('stripe', 'square', 'cash', 'card', NULL)),
  ADD COLUMN IF NOT EXISTS external_payment_id text;

-- Index for looking up bookings by payment intent (webhook reconciliation)
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent
  ON public.bookings (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- Index for looking up sales by external payment ID
CREATE INDEX IF NOT EXISTS idx_sales_external_payment
  ON public.sales (external_payment_id)
  WHERE external_payment_id IS NOT NULL;
