-- Add proof_url column to wallet_transactions for manual deposit verification
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Create private storage bucket for payment proof images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Users can upload proofs under their own uid folder
CREATE POLICY "Users can upload own payment proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own proofs
CREATE POLICY "Users can read own payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins (service role) can read all proofs — handled via service-role bypass
