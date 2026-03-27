
-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read logos
CREATE POLICY "Anyone can read logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- Allow admins to upload logos
CREATE POLICY "Admins can upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update logos
CREATE POLICY "Admins can update logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete logos
CREATE POLICY "Admins can delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'logos' AND public.has_role(auth.uid(), 'admin'::app_role));
