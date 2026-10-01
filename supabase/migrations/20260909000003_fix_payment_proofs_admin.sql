-- ── Allow admins (role admin/manager) to read all payment proofs ──────────────
-- The bucket already exists; we only add the missing admin SELECT policy.

CREATE POLICY "Admins can read all payment proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND is_admin()
  );
