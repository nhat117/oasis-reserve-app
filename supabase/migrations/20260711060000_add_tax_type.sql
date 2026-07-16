-- Tax type label (GST/VAT/Sales Tax/Custom) — snapshotted per sale, same reasoning
-- as tax_rate_percent: the tenant's configured tax type can change later, but
-- historical receipts/reports must keep showing what was actually charged.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST';
