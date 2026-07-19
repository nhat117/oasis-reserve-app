-- Per-date staff shifts — a specific calendar date's actual worked blocks,
-- distinct from therapist_weekly_hours (the recurring weekly template that
-- stays untouched and is only used as a seed default for new days). Splits
-- a work day into N independent shift blocks (e.g. 09:00-12:00 + 16:00-20:00)
-- instead of one merged shift, with break time implicit as the gap between
-- rows rather than a stored column. Overlap prevention is app-level only
-- (mutation-time JS validation), matching the existing house convention for
-- booking double-booking prevention — no other table in this codebase has a
-- DB-level overlap constraint.
CREATE TABLE public.therapist_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_minute INTEGER NOT NULL CHECK (start_minute BETWEEN 0 AND 1440),
  end_minute INTEGER NOT NULL CHECK (end_minute BETWEEN 0 AND 1440),
  notes TEXT,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT therapist_shifts_end_after_start CHECK (end_minute > start_minute)
);

CREATE INDEX idx_therapist_shifts_therapist_date ON public.therapist_shifts(therapist_id, shift_date);
CREATE INDEX idx_therapist_shifts_tenant ON public.therapist_shifts(tenant_id);

ALTER TABLE public.therapist_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_view_tenant_shifts" ON public.therapist_shifts
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_shifts" ON public.therapist_shifts
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());
