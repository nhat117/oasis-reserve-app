-- Retail products — simple sellable items (no stock/quantity tracking for v1),
-- so checkout can add retail add-on sales alongside services.
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  image_path TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_tenant ON public.products(tenant_id);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_view_tenant_products" ON public.products
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id() AND is_active = true);

CREATE POLICY "auth_view_tenant_products" ON public.products
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_my_tenant_id());

CREATE POLICY "auth_manage_tenant_products" ON public.products
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product line items on a sale — reuse sale_items rather than a new table: same
-- shape (name + price + per-sale) and lifecycle, and it's already read in every
-- place a sale's line items are read (createSale, admin sales query, receipt/detail
-- view) — a second table would mean duplicating those reads instead of adding one
-- discriminator column. service_id/product_id are both nullable; exactly one is set
-- per row depending on item_type. service_name keeps double duty as the generic
-- line-item display name for both services and products.
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('service', 'product'));

-- Product images storage bucket, mirroring service-images.
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Staff can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

CREATE POLICY "Staff can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
