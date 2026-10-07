-- Public catalogue: a visitor who is not logged in can browse the products WITHOUT any price.
-- Security by columns: `anon` may read only the listed columns (no price, tiers, reseller discount, supplier price, weight, source link…),
-- and only active products that are not reserved for resellers. Prices stay visible to authenticated users only.
REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.product_variants FROM anon;

GRANT SELECT (
  id, name, description, moq, unit, supplier_name, supplier_verified, supplier_years, supplier_country, category,
  delivery_days_min, delivery_days_max, processing_days, images, specifications, video_url,
  active, is_active, featured, stock_available, wholesale_only, sale_type, sold_count, rating, review_count, repurchase_rate,
  customization_options, tags, certifications, name_en, description_en, tags_en, customization_options_en, certifications_en, created_at
) ON public.products TO anon;

GRANT SELECT (id, product_id, group_name, label, label_en, image, stock_available, sort_order, active) ON public.product_variants TO anon;

DROP POLICY IF EXISTS products_guest_read ON public.products;
CREATE POLICY products_guest_read ON public.products FOR SELECT TO anon
  USING (active = true AND is_active = true AND NOT wholesale_only);

DROP POLICY IF EXISTS product_variants_guest_read ON public.product_variants;
CREATE POLICY product_variants_guest_read ON public.product_variants FOR SELECT TO anon
  USING (active = true AND EXISTS (
    SELECT 1 FROM public.products p
     WHERE p.id = product_variants.product_id AND p.active = true AND p.is_active = true AND NOT p.wholesale_only));
