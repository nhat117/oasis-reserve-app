
-- Settings table for app-wide configs like random therapist toggle
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (key, value) VALUES ('random_therapist_enabled', 'true');

-- Therapist unavailability table
CREATE TABLE public.therapist_unavailability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  unavailable_date date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(therapist_id, unavailable_date)
);
ALTER TABLE public.therapist_unavailability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read unavailability" ON public.therapist_unavailability FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage unavailability" ON public.therapist_unavailability FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
