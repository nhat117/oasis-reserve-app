-- Add image_path column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Create service-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read service images
CREATE POLICY "Anyone can read service images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'service-images');

-- Staff can upload service images
CREATE POLICY "Staff can upload service images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

-- Staff can update service images
CREATE POLICY "Staff can update service images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'service-images' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

-- Admins can delete service images
CREATE POLICY "Admins can delete service images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'service-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
