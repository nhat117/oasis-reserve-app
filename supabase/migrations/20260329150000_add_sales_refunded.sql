-- Add refunded tracking to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_refunded boolean NOT NULL DEFAULT false;
