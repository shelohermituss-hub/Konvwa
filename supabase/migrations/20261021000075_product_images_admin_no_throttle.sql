-- The team uploads many photos at once (imports, background removal): the 20-per-hour throttle stays for customers only.
ALTER POLICY product_images_insert ON storage.objects
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
              AND (public.is_admin() OR public.recent_uploads('product-images') < 20));
