-- The guest catalogue (migration 55) failed for visitors: two older policies on `products` applied to the `public` role, so Postgres also evaluated
-- is_admin() / is_reseller() for `anon`, which has no EXECUTE right on them ("permission denied for function is_admin").
-- Both policies are only meant for logged-in users (products_select already required auth.uid() IS NOT NULL, products_admin_all is the same as products_admin_write).
ALTER POLICY products_admin_all ON public.products TO authenticated;
ALTER POLICY products_select ON public.products TO authenticated;
