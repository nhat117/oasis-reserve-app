
-- Membership tiers
CREATE TABLE public.membership_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_visits integer NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage membership tiers" ON public.membership_tiers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read active tiers" ON public.membership_tiers FOR SELECT TO public USING (is_active = true);

-- Discount codes
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  valid_from date,
  valid_to date,
  max_uses integer,
  current_uses integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage discount codes" ON public.discount_codes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read active codes" ON public.discount_codes FOR SELECT TO public USING (is_active = true);
CREATE POLICY "Anyone can increment usage" ON public.discount_codes FOR UPDATE TO public USING (is_active = true) WITH CHECK (is_active = true);

-- Guest visits tracking
CREATE TABLE public.guest_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  customer_name text,
  visit_count integer NOT NULL DEFAULT 0,
  membership_tier_id uuid REFERENCES public.membership_tiers(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(customer_phone)
);

ALTER TABLE public.guest_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage guest visits" ON public.guest_visits FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can read guest visits" ON public.guest_visits FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert guest visits" ON public.guest_visits FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update guest visits" ON public.guest_visits FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_membership_tiers_updated_at BEFORE UPDATE ON public.membership_tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON public.discount_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_visits_updated_at BEFORE UPDATE ON public.guest_visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
