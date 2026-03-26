
-- Shop holidays table (shop-wide days off)
CREATE TABLE public.shop_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shop holidays" ON public.shop_holidays FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage shop holidays" ON public.shop_holidays FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Translation cache table
CREATE TABLE public.translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lang, key)
);
ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read translations" ON public.translations FOR SELECT TO public USING (true);
CREATE POLICY "System can manage translations" ON public.translations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
