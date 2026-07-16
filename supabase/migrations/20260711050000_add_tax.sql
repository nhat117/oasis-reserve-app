-- Real tax handling — checkout previously had no tax line at all (the
-- receipt just printed a static "GST included" string with nothing behind
-- it). Store the tax rate applied and the resulting amount per sale, so
-- receipts/reporting reflect what was actually charged even if the tenant's
-- tax rate setting changes later.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;
