-- Product options: extra choices on top of the variant (lenses, prescription power, case…), each with its own picture and price supplement.
-- A group may be shown only when another group has a choice ("show_when_group"), may allow several choices ("multi") and may be required.
-- What the customer chose is checked and PRICED here, in the database (price_product_options); the browser only displays it.
-- The chosen options are written into the order line's variant_name, so every order screen already shows them.

CREATE TABLE public.product_option_groups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  name_en         text CHECK (name_en IS NULL OR char_length(name_en) <= 80),
  sort_order      integer NOT NULL DEFAULT 0,
  required        boolean NOT NULL DEFAULT false,
  multi           boolean NOT NULL DEFAULT false,
  -- shown only when this other group has a selected option (a group that is not shown is neither required nor selectable)
  show_when_group uuid REFERENCES public.product_option_groups(id) ON DELETE SET NULL
);
CREATE INDEX idx_product_option_groups_product ON public.product_option_groups (product_id, sort_order);

CREATE TABLE public.product_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.product_option_groups(id) ON DELETE CASCADE,
  label      text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  label_en   text CHECK (label_en IS NULL OR char_length(label_en) <= 80),
  image      text CHECK (image IS NULL OR char_length(image) <= 600),
  -- supplement added to EVERY unit (never discounted by quantity tiers or offers)
  price_htg  numeric NOT NULL DEFAULT 0 CHECK (price_htg >= 0 AND price_htg <= 10000000),
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_product_options_group ON public.product_options (group_id, sort_order);

ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;

-- visitors and customers read the options of the products they can see; only the team writes
CREATE POLICY pog_read_anon ON public.product_option_groups FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.active = true));
CREATE POLICY pog_read_auth ON public.product_option_groups FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.active = true));
CREATE POLICY pog_admin_write ON public.product_option_groups FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY po_read_anon ON public.product_options FOR SELECT TO anon
  USING (active = true AND EXISTS (SELECT 1 FROM public.product_option_groups g WHERE g.id = group_id));
CREATE POLICY po_read_auth ON public.product_options FOR SELECT TO authenticated
  USING (public.is_admin() OR (active = true AND EXISTS (SELECT 1 FROM public.product_option_groups g WHERE g.id = group_id)));
CREATE POLICY po_admin_write ON public.product_options FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

REVOKE ALL ON public.product_option_groups, public.product_options FROM anon, authenticated;
GRANT SELECT ON public.product_option_groups, public.product_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_option_groups, public.product_options TO authenticated;

-- the cart remembers the chosen options (checked again when the order is placed); one line per (product, variant, options)
ALTER TABLE public.cart_items ADD COLUMN option_ids uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(option_ids) <= 30);
DROP INDEX IF EXISTS public.cart_items_user_product_variant_key;
CREATE UNIQUE INDEX cart_items_user_product_variant_options_key ON public.cart_items (user_id, product_id, variant_id, option_ids) NULLS NOT DISTINCT;

-- Checks a selection against the product's groups and prices it: {total_htg: supplement per unit, label: "Verres : Anti-bleu · Étui : Rouge"}.
-- Internal (called by the order functions): refuses unknown / inactive / foreign options, two choices in a single-choice group,
-- a choice in a group that is not shown, and a missing choice in a required group that is shown.
CREATE OR REPLACE FUNCTION public.price_product_options(p_product uuid, p_option_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_option_ids, '{}'::uuid[])) x);
  g record; v_visible boolean; v_has boolean; v_total numeric; v_label text;
BEGIN
  IF cardinality(v_ids) > 30 THEN RAISE EXCEPTION 'Trop d''options sélectionnées'; END IF;
  IF (SELECT count(*) FROM product_options o JOIN product_option_groups pg ON pg.id = o.group_id
       WHERE o.id = ANY(v_ids) AND pg.product_id = p_product AND o.active) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Option indisponible pour ce produit';
  END IF;
  FOR g IN SELECT * FROM product_option_groups WHERE product_id = p_product ORDER BY sort_order, name LOOP
    v_visible := g.show_when_group IS NULL OR EXISTS (SELECT 1 FROM product_options o WHERE o.group_id = g.show_when_group AND o.id = ANY(v_ids));
    SELECT EXISTS (SELECT 1 FROM product_options o WHERE o.group_id = g.id AND o.id = ANY(v_ids)) INTO v_has;
    IF v_has AND NOT v_visible THEN RAISE EXCEPTION 'Option non disponible avec ce choix : %', g.name; END IF;
    IF NOT g.multi AND (SELECT count(*) FROM product_options o WHERE o.group_id = g.id AND o.id = ANY(v_ids)) > 1 THEN
      RAISE EXCEPTION 'Une seule option possible pour « % »', g.name;
    END IF;
    IF v_visible AND g.required AND NOT v_has THEN RAISE EXCEPTION 'Choisissez une option pour « % »', g.name; END IF;
  END LOOP;
  SELECT coalesce(sum(o.price_htg), 0),
         coalesce(string_agg(pg.name || ' : ' || o.label, ' · ' ORDER BY pg.sort_order, pg.name, o.sort_order), '')
    INTO v_total, v_label
    FROM product_options o JOIN product_option_groups pg ON pg.id = o.group_id WHERE o.id = ANY(v_ids);
  RETURN jsonb_build_object('total_htg', v_total, 'label', v_label);
END $$;
REVOKE EXECUTE ON FUNCTION public.price_product_options(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

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
  v_opts     jsonb;
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
    v_manual := tier_price(v_prod.price_htg, (SELECT coalesce(jsonb_agg(t), '[]'::jsonb) FROM jsonb_array_elements(v_prod.price_tiers) t WHERE coalesce(t->>'src', '') <> 'sync'), v_qty);
    IF v_has_var THEN
      IF v_vid IS NULL THEN RAISE EXCEPTION 'Choisissez une variante pour « % »', v_prod.name; END IF;
      SELECT * INTO v_var FROM product_variants WHERE id = v_vid AND product_id = v_prod.id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Variante indisponible pour « % »', v_prod.name; END IF;
      IF NOT v_var.stock_available THEN RAISE EXCEPTION 'Variante en rupture de stock : % (%)', v_prod.name, v_var.label; END IF;
      v_unit := round(v_var.price_htg * CASE WHEN v_prod.price_htg > 0 THEN v_manual / v_prod.price_htg ELSE 1 END, 2);
      v_on_base := v_var.price_htg = v_prod.price_htg;
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
    -- chosen options (lenses, power, case…): checked and priced here; the supplement applies to every unit, after any discount
    v_opts := price_product_options(v_prod.id, ARRAY(SELECT x::uuid FROM jsonb_array_elements_text(coalesce(v_item->'option_ids', '[]'::jsonb)) x));
    v_line := v_line + (v_opts->>'total_htg')::numeric * v_qty;
    v_line := round(v_line, 2);
    v_price := round(v_line / v_qty, 2);

    INSERT INTO product_order_items (order_id, product_id, product_name, product_price_htg, quantity, subtotal_htg, variant_id, variant_name)
    VALUES (v_order_id, v_prod.id, v_prod.name, v_price, v_qty, v_line,
            CASE WHEN v_has_var THEN v_var.id END,
            nullif(concat_ws(' · ', CASE WHEN v_has_var THEN coalesce(v_var.group_name || ' : ', '') || v_var.label END, nullif(v_opts->>'label', '')), ''));

    v_total := v_total + v_line;
  END LOOP;

  UPDATE product_orders SET total_htg = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_product_order(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_order(jsonb, text) TO authenticated;

-- the checkout forwards the chosen options to the order function
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
      v_us_items := v_us_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty, 'variant_id', v_item ->> 'variant_id', 'option_ids', coalesce(v_item -> 'option_ids', '[]'::jsonb)));
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
      v_other_items := v_other_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty, 'variant_id', v_item ->> 'variant_id', 'option_ids', coalesce(v_item -> 'option_ids', '[]'::jsonb)));
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

REVOKE EXECUTE ON FUNCTION public.create_product_checkout(jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_checkout(jsonb, uuid, text) TO authenticated;
