-- Fix: the upload throttling policies counted rows with a sub-query on storage.objects inside a policy of storage.objects.
-- Postgres refuses that ("infinite recursion detected in policy for relation objects"), which blocked every upload
-- (avatars included). The count now lives in a SECURITY DEFINER helper, which is not expanded as a sub-query.

CREATE OR REPLACE FUNCTION public.recent_uploads(p_bucket text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM storage.objects o
   WHERE o.bucket_id = p_bucket AND o.owner = (SELECT auth.uid()) AND o.created_at > now() - interval '1 hour'
$$;
REVOKE EXECUTE ON FUNCTION public.recent_uploads(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_uploads(text) TO authenticated;

ALTER POLICY "Users upload own proofs" ON storage.objects
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.recent_uploads('payment-proofs') < 10);
ALTER POLICY kyc_docs_insert ON storage.objects
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.recent_uploads('kyc-documents') < 6);
ALTER POLICY product_images_insert ON storage.objects
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text AND public.recent_uploads('product-images') < 20);
ALTER POLICY package_photos_obj_insert ON storage.objects
  WITH CHECK (bucket_id = 'package-photos' AND is_admin() AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$' AND public.recent_uploads('package-photos') < 80);
