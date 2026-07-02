-- ============================================================
-- Pricing + Branches: tenant-scoped content for storefront pages
-- ============================================================
-- Adds tables for editable price lists (nails / waxing) and
-- physical branch locations. Read by anon storefront via
-- VITE_TENANT_ID header; managed by authenticated admins.
--
-- Tables:
--   price_categories       (e.g. 'nails', 'waxing')
--   price_tables           (a card on the pricing page)
--   price_columns          (column headers — single column or her/him split)
--   price_rows             (a service line within a table)
--   price_cells            (the price for [row × column])
--   pricing_notes          (payment policy / wax notes blocks)
--   branches               (a physical salon location)
--   branch_trading_hours   (one row per day-range entry)

-- ---------------- price_categories ----------------
CREATE TABLE IF NOT EXISTS public.price_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- ---------------- price_tables ----------------
CREATE TABLE IF NOT EXISTS public.price_tables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.price_categories(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  note         TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- price_columns ----------------
CREATE TABLE IF NOT EXISTS public.price_columns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id    UUID NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- price_rows ----------------
CREATE TABLE IF NOT EXISTS public.price_rows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id    UUID NOT NULL REFERENCES public.price_tables(id) ON DELETE CASCADE,
  service     TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- price_cells ----------------
CREATE TABLE IF NOT EXISTS public.price_cells (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  row_id      UUID NOT NULL REFERENCES public.price_rows(id) ON DELETE CASCADE,
  column_id   UUID NOT NULL REFERENCES public.price_columns(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (row_id, column_id)
);

-- ---------------- pricing_notes ----------------
-- Free-form notes blocks (payment policy, waxing safety notes, etc).
CREATE TABLE IF NOT EXISTS public.pricing_notes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id  UUID NOT NULL REFERENCES public.price_categories(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,                  -- markdown / plain text
  highlight    TEXT,                            -- e.g. cash-discount callout
  icon         TEXT,                            -- lucide icon name
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------- branches ----------------
CREATE TABLE IF NOT EXISTS public.branches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  short_label     TEXT NOT NULL,
  city            TEXT,
  address         TEXT NOT NULL,
  address_note    TEXT,
  phone           TEXT,
  instagram       TEXT,
  map_embed_url   TEXT,
  image_url       TEXT,
  public_holidays TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- ---------------- branch_trading_hours ----------------
CREATE TABLE IF NOT EXISTS public.branch_trading_hours (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  days_label  TEXT NOT NULL,                   -- e.g. "Monday – Wednesday, Friday"
  hours_label TEXT NOT NULL,                   -- e.g. "9:00am – 5:30pm"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_price_categories_tenant ON public.price_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_tables_tenant     ON public.price_tables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_price_tables_category   ON public.price_tables(category_id);
CREATE INDEX IF NOT EXISTS idx_price_columns_table     ON public.price_columns(table_id);
CREATE INDEX IF NOT EXISTS idx_price_rows_table        ON public.price_rows(table_id);
CREATE INDEX IF NOT EXISTS idx_price_cells_row         ON public.price_cells(row_id);
CREATE INDEX IF NOT EXISTS idx_price_cells_column      ON public.price_cells(column_id);
CREATE INDEX IF NOT EXISTS idx_pricing_notes_category  ON public.pricing_notes(category_id);
CREATE INDEX IF NOT EXISTS idx_branches_tenant         ON public.branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branch_hours_branch     ON public.branch_trading_hours(branch_id);

-- ============================================================
-- updated_at triggers (reuse existing helper if present)
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'price_categories', 'price_tables', 'price_columns', 'price_rows',
    'price_cells', 'pricing_notes', 'branches', 'branch_trading_hours'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- RLS — anon reads tenant-scoped rows; auth manages own tenant
-- ============================================================
ALTER TABLE public.price_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_tables         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_columns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_rows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cells          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_trading_hours ENABLE ROW LEVEL SECURITY;

-- ---- price_categories ----
CREATE POLICY "anon_view_tenant_price_categories" ON public.price_categories
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_manage_tenant_price_categories" ON public.price_categories
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- price_tables ----
CREATE POLICY "anon_view_tenant_price_tables" ON public.price_tables
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_manage_tenant_price_tables" ON public.price_tables
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- price_columns ----
CREATE POLICY "anon_view_tenant_price_columns" ON public.price_columns
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_price_columns" ON public.price_columns
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- price_rows ----
CREATE POLICY "anon_view_tenant_price_rows" ON public.price_rows
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_price_rows" ON public.price_rows
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- price_cells ----
CREATE POLICY "anon_view_tenant_price_cells" ON public.price_cells
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_price_cells" ON public.price_cells
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- pricing_notes ----
CREATE POLICY "anon_view_tenant_pricing_notes" ON public.pricing_notes
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_pricing_notes" ON public.pricing_notes
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- branches ----
CREATE POLICY "anon_view_tenant_branches" ON public.branches
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_manage_tenant_branches" ON public.branches
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- ---- branch_trading_hours ----
CREATE POLICY "anon_view_tenant_branch_hours" ON public.branch_trading_hours
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_branch_hours" ON public.branch_trading_hours
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
