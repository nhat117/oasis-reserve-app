-- Create hero-media storage bucket for hero image/video uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-media', 'hero-media', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read hero media
CREATE POLICY "Anyone can read hero media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'hero-media');

-- Staff can upload hero media
CREATE POLICY "Staff can upload hero media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hero-media' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

-- Staff can update hero media
CREATE POLICY "Staff can update hero media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'hero-media' AND (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'employee'::public.app_role)
));

-- Admins can delete hero media
CREATE POLICY "Admins can delete hero media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'hero-media' AND public.has_role(auth.uid(), 'admin'::public.app_role));
