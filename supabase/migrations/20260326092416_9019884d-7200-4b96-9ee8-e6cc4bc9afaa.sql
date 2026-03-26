ALTER TABLE public.therapists ADD COLUMN break_start integer DEFAULT NULL;
ALTER TABLE public.therapists ADD COLUMN break_end integer DEFAULT NULL;
COMMENT ON COLUMN public.therapists.break_start IS 'Break start hour (e.g. 12)';
COMMENT ON COLUMN public.therapists.break_end IS 'Break end hour (e.g. 13)';