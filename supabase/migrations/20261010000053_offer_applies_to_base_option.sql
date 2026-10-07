-- A supplier offer ("Buy 2 for $119.99", tier marked src = 'sync') applies to the base option of a product: the other variants, which have their own
-- price and are not part of the offer, keep their own price at every quantity. Manual tiers keep the same-% rule for every variant.
CREATE OR REPLACE FUNCTION public.create_product_order(p_items jsonb, p_notes text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_total    numeric := 0;
  v_item     jsonb;
  v_prod     products%ROWTYPE;
  v_var      product_variants%ROWTYPE;
  v_vid      uuid;
  v_has_var  boolean;
  v_qty      integer;
  v_price    numeric;
  v_tier     numeric;
  v_offer    boolean;
BEGIN
  IF NOT public.user_can('orders') THEN RETURN jsonb_build_object('success', false, 'error', 'Cette action est restreinte sur votre compte. Contactez le support.'); END IF;
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
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000000 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;
    v_vid := nullif(v_item->>'variant_id', '')::uuid;

    SELECT * INTO v_prod FROM products WHERE id = (v_item->>'product_id')::uuid AND active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit indisponible';
    END IF;
    IF v_prod.wholesale_only AND NOT is_reseller() THEN
      RAISE EXCEPTION 'Produit réservé aux revendeurs';
    END IF;
    IF NOT v_prod.stock_available THEN
      RAISE EXCEPTION 'Produit en rupture de stock : %', v_prod.name;
    END IF;
    IF v_qty < v_prod.moq THEN
      RAISE EXCEPTION 'Quantité minimale pour « % » : % %', v_prod.name, v_prod.moq, v_prod.unit;
    END IF;

    SELECT EXISTS (SELECT 1 FROM product_variants WHERE product_id = v_prod.id AND active) INTO v_has_var;
    v_tier := tier_price(v_prod.price_htg, v_prod.price_tiers, v_qty);
    -- is the tier in force at this quantity an offer of the supplier (src 'sync')? Such an offer belongs to the base option only
    SELECT coalesce(t->>'src', '') = 'sync' INTO v_offer
      FROM jsonb_array_elements(v_prod.price_tiers) t
     WHERE (t->>'min_qty')::integer <= v_qty
     ORDER BY (t->>'min_qty')::integer DESC LIMIT 1;
    v_offer := coalesce(v_offer, false);
    IF v_has_var THEN
      IF v_vid IS NULL THEN RAISE EXCEPTION 'Choisissez une variante pour « % »', v_prod.name; END IF;
      SELECT * INTO v_var FROM product_variants WHERE id = v_vid AND product_id = v_prod.id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible pour « % »', v_prod.name; END IF;
      IF NOT v_var.stock_available THEN RAISE EXCEPTION 'Variante en rupture de stock : % (%)', v_prod.name, v_var.label; END IF;
      v_price := round(v_var.price_htg * CASE WHEN v_prod.price_htg > 0 AND NOT (v_offer AND v_var.price_htg <> v_prod.price_htg) THEN v_tier / v_prod.price_htg ELSE 1 END, 2);
    ELSE
      IF v_vid IS NOT NULL THEN RAISE EXCEPTION 'Variante invalide pour « % »', v_prod.name; END IF;
      v_price := v_tier;
    END IF;
    IF v_prod.reseller_discount_pct > 0 AND is_reseller() THEN
      v_price := round(v_price * (1 - v_prod.reseller_discount_pct / 100), 2);
    END IF;

    INSERT INTO product_order_items (order_id, product_id, product_name, product_price_htg, quantity, subtotal_htg, variant_id, variant_name)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_price, v_qty, v_price * v_qty,
            CASE WHEN v_has_var THEN v_var.id END,
            CASE WHEN v_has_var THEN coalesce(v_var.group_name || ' : ', '') || v_var.label END);

    v_total := v_total + v_price * v_qty;
  END LOOP;

  UPDATE product_orders SET total_htg = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;
