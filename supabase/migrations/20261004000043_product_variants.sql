-- Product variants (size, colour…): each has its own regular price and image. The customer picks one; the database prices the order.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_name      text,
  label           text NOT NULL,
  label_en        text,
  price_htg       numeric NOT NULL,
  image           text,
  sku             text,
  stock_available boolean NOT NULL DEFAULT true,
  active          boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_label_chk CHECK (char_length(btrim(label)) BETWEEN 1 AND 120 AND coalesce(char_length(label_en), 0) <= 120),
  CONSTRAINT product_variants_group_chk CHECK (coalesce(char_length(group_name), 0) <= 40),
  CONSTRAINT product_variants_price_chk CHECK (price_htg > 0 AND price_htg <= 10000000),
  CONSTRAINT product_variants_image_chk CHECK (image IS NULL OR (image ~ '^https://[^[:space:]]+$' AND char_length(image) <= 500)),
  CONSTRAINT product_variants_sku_chk CHECK (coalesce(char_length(sku), 0) <= 60)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants (product_id, sort_order);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_variants_select ON public.product_variants FOR SELECT TO authenticated
  USING (is_admin() OR (active AND EXISTS (
    SELECT 1 FROM products p WHERE p.id = product_variants.product_id AND p.active = true AND (NOT p.wholesale_only OR is_reseller()))));
CREATE POLICY product_variants_admin_write ON public.product_variants FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- The cart can hold several variants of one product; orders keep a snapshot of the variant chosen.
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE;
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_variant_key ON public.cart_items (user_id, product_id, variant_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON public.cart_items (variant_id);

ALTER TABLE public.product_order_items ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL;
ALTER TABLE public.product_order_items ADD COLUMN IF NOT EXISTS variant_name text;
CREATE INDEX IF NOT EXISTS idx_product_order_items_variant_id ON public.product_order_items (variant_id);

-- Order creation, rewritten in full: a product with variants needs one (price from the variant, with the same % discount as its quantity tier).
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
    IF v_has_var THEN
      IF v_vid IS NULL THEN RAISE EXCEPTION 'Choisissez une variante pour « % »', v_prod.name; END IF;
      SELECT * INTO v_var FROM product_variants WHERE id = v_vid AND product_id = v_prod.id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible pour « % »', v_prod.name; END IF;
      IF NOT v_var.stock_available THEN RAISE EXCEPTION 'Variante en rupture de stock : % (%)', v_prod.name, v_var.label; END IF;
      v_price := round(v_var.price_htg * CASE WHEN v_prod.price_htg > 0 THEN v_tier / v_prod.price_htg ELSE 1 END, 2);
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

-- The checkout keeps the variant of each cart line (US part and other part).
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
    SELECT * INTO v_opt FROM package_shipping_options(v_kg, v_cbm, v_cat) WHERE rate_id = p_shipping_rate_id;
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

-- Staff only: replaces the variants of a product. Existing ids are updated in place (so carts and orders keep their link), the others are switched off.
CREATE OR REPLACE FUNCTION public.admin_save_product_variants(p_product uuid, p_variants jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_id uuid; v_kept uuid[] := '{}'; v_n integer := 0;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  PERFORM 1 FROM products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Produit introuvable.'); END IF;
  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liste de variantes invalide (100 maximum).');
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
    v_id := nullif(v_item ->> 'id', '')::uuid;
    IF v_id IS NOT NULL THEN
      UPDATE product_variants SET group_name = nullif(btrim(v_item ->> 'group_name'), ''), label = btrim(v_item ->> 'label'), label_en = nullif(btrim(v_item ->> 'label_en'), ''),
             price_htg = (v_item ->> 'price_htg')::numeric, image = nullif(btrim(v_item ->> 'image'), ''), sku = nullif(btrim(v_item ->> 'sku'), ''),
             stock_available = coalesce((v_item ->> 'stock_available')::boolean, true), active = coalesce((v_item ->> 'active')::boolean, true),
             sort_order = coalesce((v_item ->> 'sort_order')::integer, v_n)
       WHERE id = v_id AND product_id = p_product;
      IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Variante introuvable pour ce produit.'); END IF;
    ELSE
      INSERT INTO product_variants (product_id, group_name, label, label_en, price_htg, image, sku, stock_available, active, sort_order)
      VALUES (p_product, nullif(btrim(v_item ->> 'group_name'), ''), btrim(v_item ->> 'label'), nullif(btrim(v_item ->> 'label_en'), ''),
              (v_item ->> 'price_htg')::numeric, nullif(btrim(v_item ->> 'image'), ''), nullif(btrim(v_item ->> 'sku'), ''),
              coalesce((v_item ->> 'stock_available')::boolean, true), coalesce((v_item ->> 'active')::boolean, true), coalesce((v_item ->> 'sort_order')::integer, v_n))
      RETURNING id INTO v_id;
    END IF;
    v_kept := v_kept || v_id;
    v_n := v_n + 1;
  END LOOP;
  -- Variants removed in the editor are switched off, not erased: past orders and carts keep their link.
  UPDATE product_variants SET active = false WHERE product_id = p_product AND active AND NOT (id = ANY (v_kept));
  RETURN jsonb_build_object('success', true, 'count', v_n);
EXCEPTION WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('success', false, 'error', 'Variante invalide : libellé (1-120 caractères), prix supérieur à 0, image en https.');
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_save_product_variants(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_product_variants(uuid, jsonb) TO authenticated;
