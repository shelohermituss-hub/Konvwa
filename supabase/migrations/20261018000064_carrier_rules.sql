-- Carrier-specific shipping rules (IBC Express, Petits Courriers…):
--  1. volumetric weight per rate (L x W x H / divisor, in inches / pounds: 132 for IBC and Petits Courriers; empty = platform default 6000 cm3/kg);
--  2. small-parcel flat price per rate (parcel up to N lb and declared value up to $X: one fixed price);
--  3. item types (phone, laptop, perfume…) with, per rate, a fixed price per unit ('fixed'), a fee added to the weight price ('extra'),
--     or a price per pound for that item ('per_lb'), optionally by declared-value range.
-- cart_shipping_options is the single place that prices a US cart (checkout): the browser never decides an amount.

ALTER TABLE public.shipping_rates
  ADD COLUMN IF NOT EXISTS volumetric_divisor numeric,
  ADD COLUMN IF NOT EXISTS flat_max_lb numeric,
  ADD COLUMN IF NOT EXISTS flat_max_value_usd numeric,
  ADD COLUMN IF NOT EXISTS flat_price_usd numeric;
ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_volumetric_range;
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_volumetric_range CHECK (volumetric_divisor IS NULL OR (volumetric_divisor >= 50 AND volumetric_divisor <= 100000));
ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_flat_range;
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_flat_range CHECK (
  (flat_price_usd IS NULL OR (flat_price_usd >= 0 AND flat_price_usd <= 10000 AND flat_max_lb > 0))
  AND (flat_max_lb IS NULL OR flat_max_lb <= 100000) AND (flat_max_value_usd IS NULL OR flat_max_value_usd >= 0));

CREATE TABLE IF NOT EXISTS public.shipping_item_types (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9_]{1,40}$'),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.shipping_item_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipping_item_types_admin_all ON public.shipping_item_types;
CREATE POLICY shipping_item_types_admin_all ON public.shipping_item_types FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE TABLE IF NOT EXISTS public.shipping_item_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_id uuid NOT NULL REFERENCES public.shipping_rates(id) ON DELETE CASCADE,
  item_type text NOT NULL REFERENCES public.shipping_item_types(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('fixed', 'extra', 'per_lb')),
  price_usd numeric NOT NULL CHECK (price_usd >= 0 AND price_usd <= 100000),
  value_min_usd numeric NOT NULL DEFAULT 0 CHECK (value_min_usd >= 0),
  value_max_usd numeric CHECK (value_max_usd IS NULL OR value_max_usd > value_min_usd),
  UNIQUE (rate_id, item_type, value_min_usd)
);
CREATE INDEX IF NOT EXISTS idx_shipping_item_rules_rate ON public.shipping_item_rules (rate_id);
ALTER TABLE public.shipping_item_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shipping_item_rules_admin_all ON public.shipping_item_rules;
CREATE POLICY shipping_item_rules_admin_all ON public.shipping_item_rules FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

REVOKE ALL ON public.shipping_item_types, public.shipping_item_rules FROM anon;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_item_type text REFERENCES public.shipping_item_types(slug) ON UPDATE CASCADE ON DELETE SET NULL;

-- Prices a cart for every active rate leaving from p_country (NULL = any). p_lines: [{kg, cbm, qty, item_type, unit_usd}] (kg / cbm = totals of the line).
CREATE OR REPLACE FUNCTION public.cart_shipping_options(p_lines jsonb, p_cat uuid, p_country text)
 RETURNS TABLE(rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric, billed_kg numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  usd numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140);
  r shipping_rates%ROWTYPE; l jsonb; rule shipping_item_rules%ROWTYPE;
  v_kg numeric; v_cbm numeric; v_qty numeric; v_unit numeric;
  rem_kg numeric; rem_cbm numeric; rem_val numeric; special_usd numeric; billed numeric; w_htg numeric; total numeric;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN RETURN; END IF;
  FOR r IN SELECT * FROM shipping_rates s WHERE s.active = true AND (p_country IS NULL OR public.rate_ships_from(s.id, p_country)) ORDER BY s.sort_order, s.name LOOP
    rem_kg := 0; rem_cbm := 0; rem_val := 0; special_usd := 0; w_htg := NULL;
    FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      v_kg := coalesce((l ->> 'kg')::numeric, 0); v_cbm := coalesce((l ->> 'cbm')::numeric, 0);
      v_qty := coalesce((l ->> 'qty')::numeric, 1); v_unit := coalesce((l ->> 'unit_usd')::numeric, 0);
      rule := NULL;
      IF coalesce(l ->> 'item_type', '') <> '' THEN
        SELECT * INTO rule FROM shipping_item_rules ir
         WHERE ir.rate_id = r.id AND ir.item_type = l ->> 'item_type' AND ir.value_min_usd <= v_unit AND (ir.value_max_usd IS NULL OR v_unit <= ir.value_max_usd)
         ORDER BY ir.value_min_usd DESC LIMIT 1;
      END IF;
      IF rule.id IS NOT NULL THEN
        IF rule.mode = 'fixed' THEN special_usd := special_usd + rule.price_usd * v_qty; CONTINUE;
        ELSIF rule.mode = 'per_lb' THEN special_usd := special_usd + rule.price_usd * v_kg * 2.2046226; CONTINUE;
        ELSE special_usd := special_usd + rule.price_usd * v_qty; END IF;
      END IF;
      rem_kg := rem_kg + v_kg; rem_cbm := rem_cbm + v_cbm; rem_val := rem_val + v_unit * v_qty;
    END LOOP;

    billed := CASE WHEN r.mode = 'ocean' THEN rem_kg
                   ELSE greatest(rem_kg, rem_cbm * CASE WHEN r.volumetric_divisor > 0 THEN 61023.744 / r.volumetric_divisor / 2.2046226 ELSE 166.6667 END) END;
    IF rem_kg > 0 OR rem_cbm > 0 THEN
      IF r.flat_price_usd IS NOT NULL AND billed / 0.45359237 <= r.flat_max_lb AND (r.flat_max_value_usd IS NULL OR rem_val <= r.flat_max_value_usd) THEN
        w_htg := round((r.flat_price_usd + coalesce(r.general_fee_usd, 0)) * usd);
      ELSE
        SELECT o.amount_htg INTO w_htg FROM shipping_options_for(billed, rem_cbm, p_cat) o WHERE o.rate_id = r.id;
        IF w_htg IS NULL THEN CONTINUE; END IF;
      END IF;
    ELSIF special_usd > 0 THEN
      w_htg := round(coalesce(r.general_fee_usd, 0) * usd); billed := 0;
    ELSE
      CONTINUE;
    END IF;
    total := w_htg + round(special_usd * usd);
    IF total <= 0 THEN CONTINUE; END IF;
    rate_id := r.id; name := r.name; mode := r.mode; transit_days_min := r.transit_days_min; transit_days_max := r.transit_days_max;
    description := r.description; amount_htg := total; billed_kg := billed;
    RETURN NEXT;
  END LOOP;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.cart_shipping_options(jsonb, uuid, text) FROM PUBLIC, anon, authenticated;

-- a package known only by weight and volume (estimates): same rules, per-rate volumetric weight
CREATE OR REPLACE FUNCTION public.package_shipping_options(p_kg numeric, p_cbm numeric, p_cat uuid)
 RETURNS TABLE(rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.rate_id, o.name, o.mode, o.transit_days_min, o.transit_days_max, o.description, o.amount_htg
    FROM cart_shipping_options(jsonb_build_array(jsonb_build_object('kg', coalesce(p_kg, 0), 'cbm', coalesce(p_cbm, 0), 'qty', 1, 'unit_usd', 0)), p_cat, NULL) o;
$function$;

CREATE OR REPLACE FUNCTION public.checkout_shipping_options(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb; v_prod products%ROWTYPE; v_qty integer;
  v_us integer := 0; v_other integer := 0; v_kg numeric := 0; v_cbm numeric := 0;
  v_branded boolean := false; v_missing jsonb := '[]'::jsonb; v_cat uuid; v_opts jsonb := '[]'::jsonb; v_lines jsonb := '[]'::jsonb;
  v_usd numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140);
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié'); END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Panier vide');
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000000 THEN RETURN jsonb_build_object('success', false, 'error', 'Quantité invalide'); END IF;
    SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid AND active = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Produit indisponible'); END IF;
    IF upper(coalesce(v_prod.supplier_country, '')) = 'US' THEN
      v_us := v_us + 1;
      IF coalesce(v_prod.weight_kg, 0) > 0 AND coalesce(v_prod.length_cm, 0) > 0 AND coalesce(v_prod.width_cm, 0) > 0 AND coalesce(v_prod.height_cm, 0) > 0 THEN
        v_kg := v_kg + v_prod.weight_kg * v_qty;
        v_cbm := v_cbm + v_prod.length_cm * v_prod.width_cm * v_prod.height_cm / 1000000.0 * v_qty;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('kg', v_prod.weight_kg * v_qty,
          'cbm', v_prod.length_cm * v_prod.width_cm * v_prod.height_cm / 1000000.0 * v_qty, 'qty', v_qty,
          'item_type', v_prod.shipping_item_type, 'unit_usd', coalesce(v_prod.source_price_usd, v_prod.price_htg / v_usd)));
        IF coalesce(btrim(v_prod.brand), '') <> '' THEN v_branded := true; END IF;
      ELSE
        v_missing := v_missing || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'name', v_prod.name));
      END IF;
    ELSE
      v_other := v_other + 1;
    END IF;
  END LOOP;

  IF v_us > 0 AND jsonb_array_length(v_missing) = 0 THEN
    SELECT id INTO v_cat FROM product_rate_categories WHERE slug = CASE WHEN v_branded THEN 'branded' ELSE 'generic' END;
    SELECT coalesce(jsonb_agg(jsonb_build_object('rate_id', o.rate_id, 'name', o.name, 'mode', o.mode,
             'transit_days_min', o.transit_days_min, 'transit_days_max', o.transit_days_max, 'amount_htg', o.amount_htg, 'billed_kg', round(o.billed_kg, 3))), '[]'::jsonb)
      INTO v_opts FROM cart_shipping_options(v_lines, v_cat, 'US') o WHERE o.amount_htg > 0;
  END IF;

  RETURN jsonb_build_object('success', true, 'us_count', v_us, 'other_count', v_other, 'missing', v_missing,
    'kg', round(v_kg, 3), 'cbm', round(v_cbm, 4), 'options', v_opts);
END $$;
REVOKE EXECUTE ON FUNCTION public.checkout_shipping_options(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_shipping_options(jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION public.create_product_checkout(p_items jsonb, p_shipping_rate_id uuid DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb; v_prod products%ROWTYPE; v_qty integer;
  v_us_items jsonb := '[]'::jsonb; v_other_items jsonb := '[]'::jsonb;
  v_kg numeric := 0; v_cbm numeric := 0; v_branded boolean := false; v_missing text[] := '{}';
  v_cat uuid; v_opt record; v_lines jsonb := '[]'::jsonb;
  v_usd numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140); v_res jsonb; v_id uuid; v_orders jsonb := '[]'::jsonb; v_total numeric := 0; v_order_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié'); END IF;
  IF NOT public.user_can('orders') THEN RETURN jsonb_build_object('success', false, 'error', 'Cette action est restreinte sur votre compte. Contactez le support.'); END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Panier vide');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item ->> 'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000000 THEN RETURN jsonb_build_object('success', false, 'error', 'Quantité invalide'); END IF;
    SELECT * INTO v_prod FROM products WHERE id = (v_item ->> 'product_id')::uuid AND active = true;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Produit indisponible'); END IF;
    IF upper(coalesce(v_prod.supplier_country, '')) = 'US' THEN
      v_us_items := v_us_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty, 'variant_id', v_item ->> 'variant_id'));
      IF coalesce(v_prod.weight_kg, 0) > 0 AND coalesce(v_prod.length_cm, 0) > 0 AND coalesce(v_prod.width_cm, 0) > 0 AND coalesce(v_prod.height_cm, 0) > 0 THEN
        v_kg := v_kg + v_prod.weight_kg * v_qty;
        v_cbm := v_cbm + v_prod.length_cm * v_prod.width_cm * v_prod.height_cm / 1000000.0 * v_qty;
        v_lines := v_lines || jsonb_build_array(jsonb_build_object('kg', v_prod.weight_kg * v_qty,
          'cbm', v_prod.length_cm * v_prod.width_cm * v_prod.height_cm / 1000000.0 * v_qty, 'qty', v_qty,
          'item_type', v_prod.shipping_item_type, 'unit_usd', coalesce(v_prod.source_price_usd, v_prod.price_htg / v_usd)));
        IF coalesce(btrim(v_prod.brand), '') <> '' THEN v_branded := true; END IF;
      ELSE
        v_missing := v_missing || v_prod.name;
      END IF;
    ELSE
      v_other_items := v_other_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty, 'variant_id', v_item ->> 'variant_id'));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_us_items) > 0 THEN
    IF array_length(v_missing, 1) > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Le colis de « ' || v_missing[1] || ' » n''est pas encore renseigné : commande impossible pour le moment.');
    END IF;
    IF p_shipping_rate_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Choisissez un mode d''expédition.'); END IF;
    SELECT id INTO v_cat FROM product_rate_categories WHERE slug = CASE WHEN v_branded THEN 'branded' ELSE 'generic' END;
    SELECT * INTO v_opt FROM cart_shipping_options(v_lines, v_cat, 'US') WHERE rate_id = p_shipping_rate_id;
    IF NOT FOUND OR v_opt.amount_htg <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Mode d''expédition indisponible pour ce colis.'); END IF;

    v_res := create_product_order(v_us_items, p_notes);
    IF NOT coalesce((v_res ->> 'success')::boolean, false) THEN RETURN v_res; END IF;
    v_id := (v_res ->> 'order_id')::uuid;
    UPDATE product_orders
       SET total_htg = total_htg + v_opt.amount_htg, shipping_amount_htg = v_opt.amount_htg, chosen_shipping_rate_id = p_shipping_rate_id,
           shipping_prepaid = true, weight_kg = nullif(round(v_kg, 3), 0), cbm = nullif(round(v_cbm, 4), 0), rate_category_id = v_cat
     WHERE id = v_id RETURNING total_htg INTO v_order_total;
    v_total := v_total + v_order_total;
    v_orders := v_orders || jsonb_build_array(jsonb_build_object('order_id', v_id, 'total', v_order_total, 'shipping', v_opt.amount_htg, 'prepaid', true));
  END IF;

  IF jsonb_array_length(v_other_items) > 0 THEN
    v_res := create_product_order(v_other_items, p_notes);
    IF NOT coalesce((v_res ->> 'success')::boolean, false) THEN RAISE EXCEPTION '%', coalesce(v_res ->> 'error', 'Erreur création commande'); END IF;
    v_total := v_total + (v_res ->> 'total')::numeric;
    v_orders := v_orders || jsonb_build_array(jsonb_build_object('order_id', (v_res ->> 'order_id')::uuid, 'total', (v_res ->> 'total')::numeric, 'shipping', 0, 'prepaid', false));
  END IF;

  RETURN jsonb_build_object('success', true, 'orders', v_orders, 'total', v_total);
END $$;



-- ── Seed: official tariffs of IBC Express and Petits Courriers (Miami → Haïti, May 2026) ──
INSERT INTO public.shipping_item_types (slug, label, sort_order) VALUES
  ('phone','Téléphone',10),('smartwatch','Montre connectée',20),('earbuds','Écouteurs sans fil (AirPods, Galaxy Buds…)',30),('headphones','Casque audio',40),
  ('phone_screen','Écran de téléphone',50),('tablet','Tablette',60),('laptop','Ordinateur portable',70),('camera_pro','Caméra professionnelle',80),('drone','Drone',90),
  ('documents','Documents (enveloppe 9x12)',100),('perfume','Parfum',110),('alcohol','Alcool',120),('battery','Batterie',130),
  ('camera','Caméra',200),('surveillance_camera','Caméra de surveillance',210),('desktop','Ordinateur de bureau',220),('dvr','DVR',230),('game_console','Console de jeu',240),
  ('game_controller','Manette de jeu',250),('inverter','Onduleur',260),('inverter_regulator','Régulateur d''onduleur',270),('mini_perfume','Mini parfum',280),
  ('power_bank','Batterie externe (power bank)',290),('printer','Imprimante',300),('projector','Projecteur',310),('router','Routeur',320),
  ('screen_monitor','Écran d''ordinateur',330),('smart_tv','Smart TV 32" et plus',340),('starlink','Starlink',350)
ON CONFLICT (slug) DO NOTHING;

DO $seed$
DECLARE ibc_air uuid; ibc_sea uuid; pap uuid; cap uuid; t text; i integer;
  tiers_min numeric[] := ARRAY[0, 300.01, 700.01, 1000.01];
  tiers_max numeric[] := ARRAY[300, 700, 1000, 2000];
  ph_pap numeric[] := ARRAY[25, 30, 45, 65];  ph_cap numeric[] := ARRAY[20, 25, 40, 60];
  lp_pap numeric[] := ARRAY[45, 55, 70, 90];  lp_cap numeric[] := ARRAY[40, 50, 65, 85];
BEGIN
  SELECT id INTO ibc_air FROM shipping_rates WHERE name = 'IBC EXPRESS SHIPPING - AIR';
  SELECT id INTO ibc_sea FROM shipping_rates WHERE name = 'IBC express shipping - Bateau';
  SELECT id INTO pap FROM shipping_rates WHERE name IN ('Petit courrier - Air', 'Petits Courriers - Port-au-Prince') ORDER BY created_at LIMIT 1;

  -- IBC Express: volumetric weight / 132 (air), fixed prices per item, special per-pound prices
  IF ibc_air IS NOT NULL THEN UPDATE shipping_rates SET volumetric_divisor = 132 WHERE id = ibc_air; END IF;
  FOR t IN SELECT unnest(ARRAY[ibc_air, ibc_sea]::text[]) LOOP
    IF t IS NULL THEN CONTINUE; END IF;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES
      (t::uuid,'smartwatch','fixed',10),(t::uuid,'headphones','fixed',10),(t::uuid,'phone_screen','fixed',10),
      (t::uuid,'documents','fixed',25),
      (t::uuid,'phone','fixed',35),(t::uuid,'tablet','fixed',35),(t::uuid,'camera_pro','fixed',35),(t::uuid,'drone','fixed',35),
      (t::uuid,'laptop','fixed',55),
      (t::uuid,'perfume','extra',4),(t::uuid,'alcohol','per_lb',4),(t::uuid,'battery','per_lb',5)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Petits Courriers: Port-au-Prince (existing rate) and Cap-Haïtien (new), 3.95 / 3.40 per lb, volumetric / 132, small parcel flat price
  IF pap IS NOT NULL THEN
    UPDATE shipping_rates SET name = 'Petits Courriers - Port-au-Prince', volumetric_divisor = 132, flat_max_lb = 5, flat_max_value_usd = 200, flat_price_usd = 25,
           min_amount_usd = 0, per_kg_usd = 8.7082, transit_days_min = 10, transit_days_max = 14 WHERE id = pap;
    SELECT id INTO cap FROM shipping_rates WHERE name = 'Petits Courriers - Cap-Haïtien';
    IF cap IS NULL THEN
      INSERT INTO shipping_rates (mode, name, type_label, priority, origin_id, min_amount_usd, base_fee_usd, per_kg_usd, transit_days_min, transit_days_max, description,
                                  active, sort_order, carrier_logo_url, general_fee_usd, volumetric_divisor, flat_max_lb, flat_max_value_usd, flat_price_usd)
        SELECT mode, 'Petits Courriers - Cap-Haïtien', type_label, priority, origin_id, 0, base_fee_usd, 7.4957, 5, 7, description,
               active, sort_order + 1, carrier_logo_url, general_fee_usd, 132, 5, 200, 18 FROM shipping_rates WHERE id = pap
        RETURNING id INTO cap;
    END IF;
    FOR i IN 1..4 LOOP
      FOREACH t IN ARRAY ARRAY['phone','smartwatch','earbuds'] LOOP
        INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd, value_min_usd, value_max_usd) VALUES
          (pap, t, 'fixed', ph_pap[i], tiers_min[i], tiers_max[i]), (cap, t, 'fixed', ph_cap[i], tiers_min[i], tiers_max[i]) ON CONFLICT DO NOTHING;
      END LOOP;
      FOREACH t IN ARRAY ARRAY['laptop','tablet'] LOOP
        INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd, value_min_usd, value_max_usd) VALUES
          (pap, t, 'fixed', lp_pap[i], tiers_min[i], tiers_max[i]), (cap, t, 'fixed', lp_cap[i], tiers_min[i], tiers_max[i]) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap,'documents','fixed',35),(cap,'documents','fixed',30) ON CONFLICT DO NOTHING;
    FOR t, i IN SELECT * FROM (VALUES ('camera',10),('surveillance_camera',5),('desktop',15),('dvr',10),('game_console',10),('game_controller',5),('inverter',20),
        ('inverter_regulator',5),('power_bank',5),('printer',10),('projector',10),('router',2),('screen_monitor',10),('smart_tv',25),('starlink',50)) v(a, b) LOOP
      INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap, t, 'extra', i), (cap, t, 'extra', i) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap,'mini_perfume','extra',1.5),(cap,'mini_perfume','extra',1.5),(pap,'perfume','extra',3),(cap,'perfume','extra',3) ON CONFLICT DO NOTHING;
  END IF;
END
$seed$;
