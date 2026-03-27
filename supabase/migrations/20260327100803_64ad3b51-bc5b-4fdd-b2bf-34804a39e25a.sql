
-- Add customer_phone and customer_name to sales for walk-in tracking
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name text;
