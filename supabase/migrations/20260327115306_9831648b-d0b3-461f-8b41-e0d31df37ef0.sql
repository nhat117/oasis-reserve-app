
-- Add 'employee' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  action text NOT NULL,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read logs
CREATE POLICY "Admins can read activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Any authenticated user can insert logs
CREATE POLICY "Authenticated users can insert logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Only admins can delete logs
CREATE POLICY "Admins can delete activity logs"
ON public.activity_logs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
