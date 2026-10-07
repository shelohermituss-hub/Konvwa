-- Supplier offers are PACKS: with a "2 for $40" offer, 3 units cost one pack + one unit at the regular price, 4 units cost two packs.
-- The offers also keep their kind and numbers (to be named on the product card). Manual tiers are unchanged (their unit price applies to every unit).
CREATE OR REPLACE FUNCTION public.apply_price_sync(p_product uuid, p_new_usd numeric, p_promos jsonb DEFAULT '[]'::jsonb, p_review uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        products%ROWTYPE;
  v_ratio  numeric := 1;
  v_htg    numeric;
  v_tiers  jsonb;
  v_promo  jsonb;
  v_unit   numeric;
  v_status text := 'unchanged';
BEGIN
  IF p_new_usd IS NULL OR p_new_usd <= 0 THEN RAISE EXCEPTION 'invalid supplier price'; END IF;
  SELECT * INTO p FROM products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;

  IF p.source_price_usd IS NOT NULL THEN v_ratio := p_new_usd / p.source_price_usd; END IF;
  v_htg := CASE WHEN v_ratio = 1 THEN p.price_htg ELSE ceil(p.price_htg * v_ratio / 5) * 5 END;
  IF v_htg <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  SELECT coalesce(jsonb_agg(
           CASE WHEN v_ratio = 1 THEN t ELSE jsonb_set(t, '{price_htg}', to_jsonb(ceil((t->>'price_htg')::numeric * v_ratio / 5) * 5)) END
           ORDER BY (t->>'min_qty')::integer), '[]'::jsonb)
    INTO v_tiers
    FROM jsonb_array_elements(p.price_tiers) t
   WHERE coalesce(t->>'src', '') <> 'sync';

  FOR v_promo IN SELECT * FROM jsonb_array_elements(coalesce(p_promos, '[]'::jsonb)) LOOP
    v_unit := ceil((v_promo->>'unit_usd')::numeric * (v_htg / p_new_usd) / 5) * 5;
    IF (v_promo->>'min_qty')::integer > p.moq AND v_unit > 0 AND v_unit < v_htg
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_tiers) m WHERE (m->>'min_qty')::integer = (v_promo->>'min_qty')::integer) THEN
      -- the offer keeps its kind (multi_buy / free_item) and numbers so the shop can name it ("2 for $48", "buy 1 get 1 free")
      v_tiers := v_tiers || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'min_qty', (v_promo->>'min_qty')::integer, 'price_htg', v_unit, 'src', 'sync',
        'kind', CASE WHEN v_promo->>'kind' IN ('multi_buy', 'free_item') THEN v_promo->>'kind' END,
        'buy', (v_promo->>'buy')::integer, 'free', (v_promo->>'free')::integer, 'off', (v_promo->>'off')::integer)));
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(t ORDER BY (t->>'min_qty')::integer), '[]'::jsonb) INTO v_tiers FROM jsonb_array_elements(v_tiers) t;

  IF v_htg <> p.price_htg OR v_tiers IS DISTINCT FROM p.price_tiers THEN
    v_status := 'updated';
    IF v_ratio <> 1 THEN
      UPDATE product_variants SET price_htg = ceil(price_htg * v_ratio / 5) * 5 WHERE product_id = p_product;
    END IF;
    INSERT INTO price_sync_log (product_id, status, old_usd, new_usd, old_htg, new_htg, promos)
    VALUES (p_product, 'updated', p.source_price_usd, p_new_usd, p.price_htg, v_htg, coalesce(p_promos, '[]'::jsonb));
  END IF;

  UPDATE products SET price_htg = v_htg, price_tiers = v_tiers, source_price_usd = p_new_usd, price_checked_at = now() WHERE id = p_product;
  IF p_review IS NOT NULL THEN
    UPDATE price_sync_log SET status = 'accepted', resolved_at = now() WHERE id = p_review AND status = 'review';
  END IF;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_price_sync(uuid, numeric, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_price_sync(uuid, numeric, jsonb, uuid) TO service_role;

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
  v_manual   numeric;
  v_unit     numeric;
  v_line     numeric;
  v_plan     numeric;
  v_rem      integer;
  v_packs    integer;
  v_on_base  boolean;
  v_t        record;
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
    -- manual tiers give the price of a single unit; the supplier's offers (tier src 'sync') are PACKS of min_qty units at that unit price each:
    -- 3 units under a "2 for $40" offer cost one pack plus one unit at the regular price, 4 units cost two packs
    v_manual := tier_price(v_prod.price_htg, (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM jsonb_array_elements(v_prod.price_tiers) t WHERE coalesce(t->>'src', '') <> 'sync'), v_qty);
    IF v_has_var THEN
      IF v_vid IS NULL THEN RAISE EXCEPTION 'Choisissez une variante pour « % »', v_prod.name; END IF;
      SELECT * INTO v_var FROM product_variants WHERE id = v_vid AND product_id = v_prod.id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible pour « % »', v_prod.name; END IF;
      IF NOT v_var.stock_available THEN RAISE EXCEPTION 'Variante en rupture de stock : % (%)', v_prod.name, v_var.label; END IF;
      v_unit := round(v_var.price_htg * CASE WHEN v_prod.price_htg > 0 THEN v_manual / v_prod.price_htg ELSE 1 END, 2);
      v_on_base := v_var.price_htg = v_prod.price_htg;   -- an offer belongs to the base option: other variants keep their own price
    ELSE
      IF v_vid IS NOT NULL THEN RAISE EXCEPTION 'Variante invalide pour « % »', v_prod.name; END IF;
      v_unit := v_manual;
      v_on_base := true;
    END IF;
    v_line := v_unit * v_qty;
    IF v_on_base THEN
      v_rem := v_qty; v_plan := 0;
      FOR v_t IN SELECT (t->>'min_qty')::integer AS size, (t->>'price_htg')::numeric AS unit_price
                   FROM jsonb_array_elements(v_prod.price_tiers) t WHERE t->>'src' = 'sync' ORDER BY (t->>'min_qty')::integer DESC LOOP
        v_packs := v_rem / v_t.size;
        v_plan := v_plan + v_packs * v_t.size * v_t.unit_price;
        v_rem := v_rem - v_packs * v_t.size;
      END LOOP;
      v_plan := v_plan + v_rem * v_unit;
      v_line := least(v_line, v_plan);
    END IF;
    IF v_prod.reseller_discount_pct > 0 AND is_reseller() THEN
      v_line := v_line * (1 - v_prod.reseller_discount_pct / 100);
    END IF;
    v_line := round(v_line, 2);
    v_price := round(v_line / v_qty, 2);   -- average unit price of the line

    INSERT INTO product_order_items (order_id, product_id, product_name, product_price_htg, quantity, subtotal_htg, variant_id, variant_name)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_price, v_qty, v_line,
            CASE WHEN v_has_var THEN v_var.id END,
            CASE WHEN v_has_var THEN coalesce(v_var.group_name || ' : ', '') || v_var.label END);

    v_total := v_total + v_line;
  END LOOP;

  UPDATE product_orders SET total_htg = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;

