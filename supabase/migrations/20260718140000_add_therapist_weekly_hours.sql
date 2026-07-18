-- Recurring per-day-of-week working hours — replaces the single
-- start_hour/end_hour/break_start/break_end/working_days tuple that
-- applied identically to every day a therapist worked. One row per
-- therapist per day of week (1=Mon..7=Sun); is_working=false means the
-- therapist is off that day (equivalent to being absent from working_days).
CREATE TABLE public.therapist_weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  is_working BOOLEAN NOT NULL DEFAULT true,
  start_hour INTEGER NOT NULL DEFAULT 9,
  end_hour INTEGER NOT NULL DEFAULT 18,
  break_start INTEGER,
  break_end INTEGER,
  tenant_id UUID REFERENCES public.tenants(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(therapist_id, day_of_week)
);

CREATE INDEX idx_therapist_weekly_hours_therapist ON public.therapist_weekly_hours(therapist_id);
CREATE INDEX idx_therapist_weekly_hours_tenant ON public.therapist_weekly_hours(tenant_id);

ALTER TABLE public.therapist_weekly_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_view_tenant_weekly_hours" ON public.therapist_weekly_hours
  FOR SELECT TO anon
  USING (tenant_id = public.request_tenant_id());

CREATE POLICY "auth_manage_tenant_weekly_hours" ON public.therapist_weekly_hours
  FOR ALL TO authenticated
  USING (tenant_id = public.get_my_tenant_id())
  WITH CHECK (tenant_id = public.get_my_tenant_id());

-- Backfill one row per (therapist, day-in-working_days) from the existing
-- flat start_hour/end_hour/break_start/break_end so every currently-working
-- day keeps its current hours after the cutover.
INSERT INTO public.therapist_weekly_hours (therapist_id, day_of_week, is_working, start_hour, end_hour, break_start, break_end, tenant_id)
SELECT t.id, d.day, true, t.start_hour, t.end_hour, t.break_start, t.break_end, t.tenant_id
FROM public.therapists t
CROSS JOIN LATERAL unnest(t.working_days) AS d(day);

-- Days a therapist did NOT work under the old working_days array are
-- implicitly off — no row means "not working" in the new model, so no
-- explicit is_working=false backfill is needed for those days.
