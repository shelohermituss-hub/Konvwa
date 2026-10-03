-- 1. Admin config policies compared profiles.id with auth.uid(), but profiles.id is not the user id,
--    so they never matched: admins could not edit rates, origins, regions, cities or product types.
ALTER POLICY haiti_cities_ins ON haiti_cities WITH CHECK (is_admin());
ALTER POLICY haiti_cities_upd ON haiti_cities USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY haiti_cities_del ON haiti_cities USING (is_admin());
ALTER POLICY haiti_regions_ins ON haiti_regions WITH CHECK (is_admin());
ALTER POLICY haiti_regions_upd ON haiti_regions USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY haiti_regions_del ON haiti_regions USING (is_admin());
ALTER POLICY product_types_ins ON product_types WITH CHECK (is_admin());
ALTER POLICY product_types_upd ON product_types USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY product_types_del ON product_types USING (is_admin());
ALTER POLICY shipping_origins_ins ON shipping_origins WITH CHECK (is_admin());
ALTER POLICY shipping_origins_upd ON shipping_origins USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY shipping_origins_del ON shipping_origins USING (is_admin());
ALTER POLICY shipping_rates_admin_all ON shipping_rates USING (is_admin()) WITH CHECK (is_admin());

-- 2. Orders are created by admins (quotes) or by RPCs only
ALTER POLICY users_insert_own_orders ON orders WITH CHECK (false);

-- 3. Product orders: price and total come from the database, never from the browser
ALTER POLICY product_orders_user_insert ON product_orders WITH CHECK (false);
ALTER POLICY poi_insert ON product_order_items WITH CHECK (false);

CREATE OR REPLACE FUNCTION create_product_order(p_items jsonb, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_total    numeric := 0;
  v_item     jsonb;
  v_prod     products%ROWTYPE;
  v_qty      integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Panier vide');
  END IF;

  INSERT INTO product_orders (user_id, total_htg, status, payment_status, notes)
  VALUES (v_uid, 0, 'pending', 'unpaid', p_notes)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 10000 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;

    SELECT * INTO v_prod FROM products WHERE id = (v_item->>'product_id')::uuid AND active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit indisponible';
    END IF;

    INSERT INTO product_order_items (order_id, product_id, product_name, product_price_htg, quantity, subtotal_htg)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_prod.price_htg, v_qty, v_prod.price_htg * v_qty);

    v_total := v_total + v_prod.price_htg * v_qty;
  END LOOP;

  UPDATE product_orders SET total_htg = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION create_product_order(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_product_order(jsonb, text) TO authenticated;

-- 4. A product request starts as a plain request: amounts, payment and batch are set by admins / RPCs
ALTER POLICY users_insert_own_requests ON product_requests
  WITH CHECK (
    (select auth.uid()) = user_id
    AND request_type = 'product'
    AND status IN ('draft', 'submitted')
    AND quoted_amount_htg IS NULL AND actual_amount_htg IS NULL
    AND shipment_id IS NULL AND quoted_rate_id IS NULL
    AND coalesce(paid_amount_htg, 0) = 0 AND coalesce(late_fee_htg, 0) = 0
  );

-- 5. Legacy tables from another app, unused here
REVOKE ALL ON TABLE public.currency_accounts, public.jars, public.beneficiaries, public.transactions, public.wise_users, public.store_notifications FROM anon, authenticated;
