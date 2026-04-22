-- Create public bucket for QR code images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-images',
  'qr-images',
  true,
  2097152, -- 2 MB limit
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to QR images
CREATE POLICY "Public read qr images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'qr-images');

-- Allow authenticated users with owner/super_admin role to upload
-- (service role bypasses RLS, so this covers server actions)
CREATE POLICY "Authenticated upload qr images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'qr-images');

CREATE POLICY "Authenticated update qr images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'qr-images');
