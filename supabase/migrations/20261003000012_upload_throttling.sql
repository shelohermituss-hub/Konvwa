-- Upload throttling: a user can add at most 10 payment proofs / 20 product images per hour
ALTER POLICY "Users upload own proofs" ON storage.objects
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT count(*) FROM storage.objects o
          WHERE o.bucket_id = 'payment-proofs' AND o.owner = (SELECT auth.uid())
            AND o.created_at > now() - interval '1 hour') < 10
  );

ALTER POLICY product_images_insert ON storage.objects
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT count(*) FROM storage.objects o
          WHERE o.bucket_id = 'product-images' AND o.owner = (SELECT auth.uid())
            AND o.created_at > now() - interval '1 hour') < 20
  );

-- To run by hand (the SQL API cancels DROP): the old policy "Admins read all proofs" duplicates
-- "Admins can read all payment proofs" and uses an inline query on profiles.
--   DROP POLICY "Admins read all proofs" ON storage.objects;
