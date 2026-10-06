-- Checkout shipping methods are limited to the origin of the products: US products only get the methods that leave from the USA.
CREATE OR REPLACE FUNCTION public.rate_ships_from(p_rate uuid, p_country text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM shipping_rates r JOIN shipping_origins o ON o.id = r.origin_id
                  WHERE r.id = p_rate AND upper(coalesce(o.country_code, '')) = upper(p_country));
$$;
REVOKE EXECUTE ON FUNCTION public.rate_ships_from(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.checkout_shipping_options(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item jsonb; v_prod products%ROWTYPE; v_qty integer;
  v_us integer := 0; v_other integer := 0; v_kg numeric := 0; v_cbm numeric := 0;
  v_branded boolean := false; v_missing jsonb := '[]'::jsonb; v_cat uuid; v_opts jsonb := '[]'::jsonb;
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
             'transit_days_min', o.transit_days_min, 'transit_days_max', o.transit_days_max, 'amount_htg', o.amount_htg)), '[]'::jsonb)
      INTO v_opts FROM package_shipping_options(v_kg, v_cbm, v_cat) o WHERE o.amount_htg > 0 AND public.rate_ships_from(o.rate_id, 'US');
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
  v_cat uuid; v_opt record; v_res jsonb; v_id uuid; v_orders jsonb := '[]'::jsonb; v_total numeric := 0; v_order_total numeric;
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
    SELECT * INTO v_opt FROM package_shipping_options(v_kg, v_cbm, v_cat) WHERE rate_id = p_shipping_rate_id AND public.rate_ships_from(rate_id, 'US');
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

