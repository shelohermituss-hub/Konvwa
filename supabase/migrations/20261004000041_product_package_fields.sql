-- Package data on catalogue products (used to estimate the shipping cost) + source of an imported product.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_kg numeric(8,3),
  ADD COLUMN IF NOT EXISTS length_cm numeric(8,1),
  ADD COLUMN IF NOT EXISTS width_cm numeric(8,1),
  ADD COLUMN IF NOT EXISTS height_cm numeric(8,1),
  ADD COLUMN IF NOT EXISTS package_estimated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_asin text;

ALTER TABLE public.products
  ADD CONSTRAINT products_package_chk CHECK (
    (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 1000))
    AND (length_cm IS NULL OR (length_cm > 0 AND length_cm <= 1000))
    AND (width_cm IS NULL OR (width_cm > 0 AND width_cm <= 1000))
    AND (height_cm IS NULL OR (height_cm > 0 AND height_cm <= 1000)));
ALTER TABLE public.products
  ADD CONSTRAINT products_brand_len_chk CHECK (brand IS NULL OR char_length(brand) <= 120);
ALTER TABLE public.products
  ADD CONSTRAINT products_source_chk CHECK (
    (source_url IS NULL OR (source_url ~ '^https://[^[:space:]]+$' AND char_length(source_url) <= 500))
    AND (source_asin IS NULL OR source_asin ~ '^[A-Z0-9]{10}$'));

-- Staff-only shipping estimate for a package: air is charged on the greater of actual and volumetric weight (L×W×H/6000),
-- ocean on the greater of volume and actual weight (same rule as shipping_options_for). Amounts are in HTG.
CREATE OR REPLACE FUNCTION public.admin_product_shipping_estimate(
  p_kg numeric, p_length numeric, p_width numeric, p_height numeric,
  p_qty integer DEFAULT 1, p_category_slug text DEFAULT 'generic')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty integer := coalesce(p_qty, 1);
  v_kg numeric; v_vol_kg numeric := 0; v_cbm numeric := 0; v_charge numeric;
  v_cat uuid; v_opts jsonb;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Accès refusé.'); END IF;
  IF v_qty < 1 OR v_qty > 100000 THEN RETURN jsonb_build_object('success', false, 'error', 'Quantité invalide.'); END IF;
  IF coalesce(p_kg, 0) < 0 OR coalesce(p_kg, 0) > 1000
     OR coalesce(p_length, 0) < 0 OR coalesce(p_length, 0) > 1000
     OR coalesce(p_width, 0) < 0 OR coalesce(p_width, 0) > 1000
     OR coalesce(p_height, 0) < 0 OR coalesce(p_height, 0) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Poids ou dimensions invalides.');
  END IF;
  v_kg := coalesce(p_kg, 0) * v_qty;
  IF coalesce(p_length, 0) > 0 AND coalesce(p_width, 0) > 0 AND coalesce(p_height, 0) > 0 THEN
    v_cbm := p_length * p_width * p_height / 1000000.0 * v_qty;
    v_vol_kg := p_length * p_width * p_height / 6000.0 * v_qty;
  END IF;
  v_charge := greatest(v_kg, v_vol_kg);
  IF v_charge <= 0 AND v_cbm <= 0 THEN
    RETURN jsonb_build_object('success', true, 'kg', 0, 'chargeable_kg', 0, 'cbm', 0, 'options', '[]'::jsonb);
  END IF;
  SELECT id INTO v_cat FROM product_rate_categories WHERE slug = coalesce(p_category_slug, 'generic');

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'rate_id', o.rate_id, 'name', o.name, 'mode', o.mode,
           'transit_days_min', o.transit_days_min, 'transit_days_max', o.transit_days_max,
           'amount_htg', o.amount_htg, 'per_unit_htg', round(o.amount_htg / v_qty)) ORDER BY o.sort_order, o.name), '[]'::jsonb)
    INTO v_opts
    FROM (
      SELECT a.*, r.sort_order FROM shipping_options_for(v_charge, v_cbm, v_cat) a JOIN shipping_rates r ON r.id = a.rate_id WHERE a.mode <> 'ocean'
      UNION ALL
      SELECT b.*, r.sort_order FROM shipping_options_for(v_kg, v_cbm, v_cat) b JOIN shipping_rates r ON r.id = b.rate_id WHERE b.mode = 'ocean'
    ) o;

  RETURN jsonb_build_object('success', true, 'kg', round(v_kg, 3), 'chargeable_kg', round(v_charge, 3), 'cbm', round(v_cbm, 4), 'options', v_opts);
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_product_shipping_estimate(numeric, numeric, numeric, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_shipping_estimate(numeric, numeric, numeric, numeric, integer, text) TO authenticated;
