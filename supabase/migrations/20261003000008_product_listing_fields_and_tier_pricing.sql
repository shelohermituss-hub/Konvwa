-- Alibaba-style product listing: supplier trust, social proof, price by quantity, customization
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS supplier_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_years integer,
  ADD COLUMN IF NOT EXISTS supplier_country text DEFAULT 'CN',
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repurchase_rate integer,
  ADD COLUMN IF NOT EXISTS processing_days integer,
  ADD COLUMN IF NOT EXISTS customization_options text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications text[] NOT NULL DEFAULT '{}';

ALTER TABLE products
  ADD CONSTRAINT products_price_tiers_is_array CHECK (jsonb_typeof(price_tiers) = 'array'),
  ADD CONSTRAINT products_rating_range CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  ADD CONSTRAINT products_repurchase_range CHECK (repurchase_rate IS NULL OR (repurchase_rate >= 0 AND repurchase_rate <= 100)),
  ADD CONSTRAINT products_counts_nonnegative CHECK (sold_count >= 0 AND review_count >= 0);

-- Unit price for a quantity: the tier with the highest min_qty that the quantity reaches, else the base price
CREATE OR REPLACE FUNCTION tier_price(p_base numeric, p_tiers jsonb, p_qty integer)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT (t->>'price_htg')::numeric
       FROM jsonb_array_elements(p_tiers) AS t
      WHERE (t->>'min_qty')::integer <= p_qty
      ORDER BY (t->>'min_qty')::integer DESC
      LIMIT 1),
    p_base
  );
$$;
REVOKE ALL ON FUNCTION tier_price(numeric, jsonb, integer) FROM PUBLIC, anon, authenticated;

-- Orders are priced by the database, now with quantity tiers, stock and the minimum order quantity
CREATE OR REPLACE FUNCTION create_product_order(p_items jsonb, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_total    numeric := 0;
  v_item     jsonb;
  v_prod     products%ROWTYPE;
  v_qty      integer;
  v_price    numeric;
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
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000000 THEN
      RAISE EXCEPTION 'Quantité invalide';
    END IF;

    SELECT * INTO v_prod FROM products WHERE id = (v_item->>'product_id')::uuid AND active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit indisponible';
    END IF;
    IF NOT v_prod.stock_available THEN
      RAISE EXCEPTION 'Produit en rupture de stock : %', v_prod.name;
    END IF;
    IF v_qty < v_prod.moq THEN
      RAISE EXCEPTION 'Quantité minimale pour « % » : % %', v_prod.name, v_prod.moq, v_prod.unit;
    END IF;

    v_price := tier_price(v_prod.price_htg, v_prod.price_tiers, v_qty);

    INSERT INTO product_order_items (order_id, product_id, product_name, product_price_htg, quantity, subtotal_htg)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_price, v_qty, v_price * v_qty);

    v_total := v_total + v_price * v_qty;
  END LOOP;

  UPDATE product_orders SET total_htg = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION create_product_order(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_product_order(jsonb, text) TO authenticated;
