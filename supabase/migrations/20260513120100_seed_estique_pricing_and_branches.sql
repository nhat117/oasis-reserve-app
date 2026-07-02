-- ============================================================
-- Seed: Estique pricing + ESTIQUE KIRRAWEE branch
-- ============================================================
-- Idempotent: re-running will replace existing pricing for the
-- Estique tenant rather than appending duplicates.
--
-- Tenant slug used here is 'royal-head-spa'. If your tenant slug differs,
-- edit the v_tenant_slug below or copy the rows after running.

DO $$
DECLARE
  v_tenant_slug   TEXT := 'royal-head-spa';
  v_tenant_id     UUID;
  v_nails_cat     UUID;
  v_waxing_cat    UUID;
  v_branch_id     UUID;
  v_table_id      UUID;
  v_col_a         UUID;
  v_col_b         UUID;
  v_col_her       UUID;
  v_col_him       UUID;
  v_row_id        UUID;
BEGIN
  -- Find the existing tenant (must exist before this seed runs)
  SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_tenant_slug LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant with slug % not found. Create it first.', v_tenant_slug;
  END IF;

  -- Wipe prior seed for this tenant so we can re-run cleanly
  DELETE FROM public.price_categories WHERE tenant_id = v_tenant_id;
  DELETE FROM public.branches         WHERE tenant_id = v_tenant_id;

  -- Categories
  INSERT INTO public.price_categories (tenant_id, slug, name, sort_order)
  VALUES (v_tenant_id, 'nails',  'Nails',  1) RETURNING id INTO v_nails_cat;

  INSERT INTO public.price_categories (tenant_id, slug, name, sort_order)
  VALUES (v_tenant_id, 'waxing', 'Waxing', 2) RETURNING id INTO v_waxing_cat;

  -- ============================================================
  -- NAILS — Nail Extension / Acrylic (multi-column)
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Extension / Acrylic', 1)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Normal Polish', 1) RETURNING id INTO v_col_a;
  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Shellac', 2) RETURNING id INTO v_col_b;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Set', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_a, '$50'),
    (v_tenant_id, v_row_id, v_col_b, '$60');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Infill', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_a, '$40'),
    (v_tenant_id, v_row_id, v_col_b, '$50');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Overlay', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_a, '$45'),
    (v_tenant_id, v_row_id, v_col_b, '$55');

  -- ============================================================
  -- NAILS — SNS (single column)
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'SNS', 2)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Set', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$60');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Overlay', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$55');

  -- ============================================================
  -- NAILS — Nail Enhancement
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, note, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Enhancement', 'Gel Builder · BIAB · Tap Gel · Hard Gel', 3)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Set', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$70');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Infill', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $55');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Overlay', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$65');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Gel X — Full Set', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$65');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Dual Form — Full Set', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$70');

  -- ============================================================
  -- NAILS — Add-ons
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, note, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Add-ons', 'Applied to all services', 4)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, '1–2 fixed nails', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $5');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, '3+ fixed nails', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Long nail (length)', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $5');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Soak off', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'extra $10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Manicure', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'extra $15');

  -- ============================================================
  -- NAILS — Hand Care: Normal Polish
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Care for Hands — Normal Polish', 5)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Cut + Buff Shape + Normal Polish', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Change colour on Acrylic or BIAB', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Manicure', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$25');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Male Manicure', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$30');

  -- ============================================================
  -- NAILS — Hand Care: Shellac Polish
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Care for Hands — Shellac Polish', 6)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Cut + Buff Shape + Shellac', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$30');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Manicure', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$35');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Change colour on Acrylic or BIAB', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$40');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Removal of Shellac', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Removal of Acrylic / BIAB / Gel X & Buff + Shape', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$20');

  -- ============================================================
  -- NAILS — Nail Art
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, note, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Art', 'Intricate designs charged based on time and complexity', 7)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'French tip', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Cat eyes polish', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Ombre', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Polka dot', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Chrome', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Custom nail art & design', 6) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'P.O.A.');

  -- ============================================================
  -- NAILS — Foot Care: Normal
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Care for Feet — Normal Polish', 8)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Cut + Buff Shape + Normal Polish', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Pedicure', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$40');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Male Pedicure', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$45');

  -- ============================================================
  -- NAILS — Foot Care: Shellac & Enhancement
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_nails_cat, 'Nail Care for Feet — Shellac & Enhancement', 9)
  RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Price', 1) RETURNING id INTO v_col_a;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Cut + Buff Shape + Shellac', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$35');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Pedicure (Shellac)', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$50');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Change colour on Acrylic or BIAB', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$40');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, '1 Acrylic / BIAB toe nail', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, '2+ Acrylic / BIAB toe nails', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, 'from $15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Acrylic Full Set on Feet', 6) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$65');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Acrylic Full Set + Pedicure', 7) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$90');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'BIAB Full Set on Feet', 8) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$70');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'BIAB Full Set + Pedicure', 9) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$95');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Removal of Shellac', 10) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value)
  VALUES (v_tenant_id, v_row_id, v_col_a, '$15');

  -- ============================================================
  -- WAXING — Face Wax (her / him)
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_waxing_cat, 'Face Wax', 1) RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'For Her', 1) RETURNING id INTO v_col_her;
  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'For Him', 2) RETURNING id INTO v_col_him;

  -- helper: insert a face wax row
  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Eyebrow', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$15'),
    (v_tenant_id, v_row_id, v_col_him, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Eyelash Tint', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$25'),
    (v_tenant_id, v_row_id, v_col_him, '—');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Eyebrow Tint', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$20'),
    (v_tenant_id, v_row_id, v_col_him, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Eyebrow Wax + Tint', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$25'),
    (v_tenant_id, v_row_id, v_col_him, '$30');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Lip', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$10'),
    (v_tenant_id, v_row_id, v_col_him, '$10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Chin', 6) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$10'),
    (v_tenant_id, v_row_id, v_col_him, '$10');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Eyebrow + Lip + Chin', 7) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$30'),
    (v_tenant_id, v_row_id, v_col_him, '$35');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Nostrils', 8) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$15'),
    (v_tenant_id, v_row_id, v_col_him, '$15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Ear', 9) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$15'),
    (v_tenant_id, v_row_id, v_col_him, '$15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Facial Sides', 10) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$20'),
    (v_tenant_id, v_row_id, v_col_him, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Facial (brows included)', 11) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$45'),
    (v_tenant_id, v_row_id, v_col_him, '$50');

  -- ============================================================
  -- WAXING — Body Wax (her / him)
  -- ============================================================
  INSERT INTO public.price_tables (tenant_id, category_id, title, sort_order)
  VALUES (v_tenant_id, v_waxing_cat, 'Body Wax', 2) RETURNING id INTO v_table_id;

  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'For Her', 1) RETURNING id INTO v_col_her;
  INSERT INTO public.price_columns (tenant_id, table_id, label, sort_order)
  VALUES (v_tenant_id, v_table_id, 'For Him', 2) RETURNING id INTO v_col_him;

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Neck', 1) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '—'),
    (v_tenant_id, v_row_id, v_col_him, '$15');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Underarm', 2) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, 'from $15'),
    (v_tenant_id, v_row_id, v_col_him, '$20');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Half Arm', 3) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$20'),
    (v_tenant_id, v_row_id, v_col_him, '$30');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Arm', 4) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$35'),
    (v_tenant_id, v_row_id, v_col_him, '$40');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Half Leg', 5) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$25'),
    (v_tenant_id, v_row_id, v_col_him, '$30');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Leg', 6) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$45'),
    (v_tenant_id, v_row_id, v_col_him, '$50');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Full Back', 7) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$40'),
    (v_tenant_id, v_row_id, v_col_him, '$45');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Stomach', 8) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '$25'),
    (v_tenant_id, v_row_id, v_col_him, '$30');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Chest + Shoulder', 9) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '—'),
    (v_tenant_id, v_row_id, v_col_him, '$40');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Chest + Stomach', 10) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '—'),
    (v_tenant_id, v_row_id, v_col_him, '$45');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Chest + Shoulder + Stomach', 11) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, '—'),
    (v_tenant_id, v_row_id, v_col_him, '$60');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Bikini Line', 12) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, 'from $20'),
    (v_tenant_id, v_row_id, v_col_him, '—');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Buttock', 13) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, 'from $30'),
    (v_tenant_id, v_row_id, v_col_him, '—');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'G-String', 14) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, 'from $25'),
    (v_tenant_id, v_row_id, v_col_him, '—');

  INSERT INTO public.price_rows (tenant_id, table_id, service, sort_order)
  VALUES (v_tenant_id, v_table_id, 'Brazilian', 15) RETURNING id INTO v_row_id;
  INSERT INTO public.price_cells (tenant_id, row_id, column_id, value) VALUES
    (v_tenant_id, v_row_id, v_col_her, 'from $50'),
    (v_tenant_id, v_row_id, v_col_him, '—');

  -- ============================================================
  -- Pricing notes
  -- ============================================================
  INSERT INTO public.pricing_notes (tenant_id, category_id, title, body, highlight, icon, sort_order)
  VALUES (
    v_tenant_id, v_nails_cat,
    'Payment Policy',
    'Full payment required on the day of service.' || E'\n' ||
    'No credit or later payment accepted.' || E'\n' ||
    'Bank transfer receipt must be shown before leaving.',
    'Special offer: 10% off for cash payments — valid on purchases of $45 and above.',
    'Wallet',
    1
  );

  INSERT INTO public.pricing_notes (tenant_id, category_id, title, body, icon, sort_order)
  VALUES (
    v_tenant_id, v_waxing_cat,
    'Important Notes',
    'Please inform our staff of any allergies or skin conditions before your appointment.' || E'\n' ||
    'Prices may vary depending on hair thickness and time consumed.' || E'\n' ||
    'Follow us on Instagram for our newest promotions and updates: @ausomenails.kirrawee',
    'Info',
    1
  );

  -- ============================================================
  -- Branch — ESTIQUE KIRRAWEE
  -- ============================================================
  INSERT INTO public.branches (
    tenant_id, slug, name, short_label, city,
    address, address_note, phone, instagram,
    map_embed_url, public_holidays, sort_order
  ) VALUES (
    v_tenant_id, 'kirrawee',
    'Estique Kirrawee', 'ESTIQUE KIRRAWEE', 'Kirrawee, NSW',
    'Shop 2/24-32 Flora Street, Kirrawee NSW 2232',
    'Kirrawee Shopping Centre',
    '02 8544 3900',
    '@ausomenails.kirrawee',
    'https://www.google.com/maps?q=Shop+2%2F24-32+Flora+Street%2C+Kirrawee+NSW+2232&output=embed',
    'Hours may vary',
    1
  ) RETURNING id INTO v_branch_id;

  INSERT INTO public.branch_trading_hours (tenant_id, branch_id, days_label, hours_label, sort_order) VALUES
    (v_tenant_id, v_branch_id, 'Monday – Wednesday, Friday', '9:00am – 5:30pm', 1),
    (v_tenant_id, v_branch_id, 'Thursday',                   '9:00am – 9:00pm', 2),
    (v_tenant_id, v_branch_id, 'Saturday – Sunday',          '9:00am – 5:00pm', 3);
END $$;
