-- Catalogue products shipped from the USA (supplier_country = 'US', e.g. Amazon) are sold "all inclusive":
-- the customer picks a shipping method at checkout and pays products + shipping at once. Chinese products stay "purchase only"
-- (shipping is paid when the parcel reaches the warehouse). A mixed cart is split into two orders.
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS shipping_prepaid boolean NOT NULL DEFAULT false;

-- Shipping options for a package: air on the greater of actual and volumetric weight (1 m3 = 166.67 kg), ocean on volume or weight.
CREATE OR REPLACE FUNCTION public.package_shipping_options(p_kg numeric, p_cbm numeric, p_cat uuid)
RETURNS TABLE(rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.rate_id, o.name, o.mode, o.transit_days_min, o.transit_days_max, o.description, o.amount_htg
    FROM (
      SELECT a.*, r.sort_order FROM shipping_options_for(greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 166.6667), p_cbm, p_cat) a
        JOIN shipping_rates r ON r.id = a.rate_id WHERE a.mode <> 'ocean'
      UNION ALL
      SELECT b.*, r.sort_order FROM shipping_options_for(p_kg, p_cbm, p_cat) b
        JOIN shipping_rates r ON r.id = b.rate_id WHERE b.mode = 'ocean'
    ) o
   ORDER BY o.sort_order, o.name;
$$;
REVOKE EXECUTE ON FUNCTION public.package_shipping_options(numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;

-- What the checkout shows: the US part of the cart, its package and the shipping methods with their price.
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
      INTO v_opts FROM package_shipping_options(v_kg, v_cbm, v_cat) o WHERE o.amount_htg > 0;
  END IF;

  RETURN jsonb_build_object('success', true, 'us_count', v_us, 'other_count', v_other, 'missing', v_missing,
    'kg', round(v_kg, 3), 'cbm', round(v_cbm, 4), 'options', v_opts);
END $$;
REVOKE EXECUTE ON FUNCTION public.checkout_shipping_options(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_shipping_options(jsonb) TO authenticated;

-- Creates the order(s) of a cart: the US part with its shipping included (price recomputed here, never taken from the browser),
-- the rest as a purchase-only order. Payment is done afterwards with pay_product_order for each order.
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
      v_us_items := v_us_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty));
      IF coalesce(v_prod.weight_kg, 0) > 0 AND coalesce(v_prod.length_cm, 0) > 0 AND coalesce(v_prod.width_cm, 0) > 0 AND coalesce(v_prod.height_cm, 0) > 0 THEN
        v_kg := v_kg + v_prod.weight_kg * v_qty;
        v_cbm := v_cbm + v_prod.length_cm * v_prod.width_cm * v_prod.height_cm / 1000000.0 * v_qty;
        IF coalesce(btrim(v_prod.brand), '') <> '' THEN v_branded := true; END IF;
      ELSE
        v_missing := v_missing || v_prod.name;
      END IF;
    ELSE
      v_other_items := v_other_items || jsonb_build_array(jsonb_build_object('product_id', v_prod.id, 'quantity', v_qty));
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
REVOKE EXECUTE ON FUNCTION public.create_product_checkout(jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_checkout(jsonb, uuid, text) TO authenticated;

-- Paying a prepaid order also settles its shipping: the shipping step is done from the start.
CREATE OR REPLACE FUNCTION public.pay_product_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   uuid;
  v_total     numeric;
  v_status    text;
  v_prepaid   boolean;
  v_balance   numeric;
  v_wallet_id uuid;
BEGIN
  IF NOT public.user_can('payments') THEN RETURN jsonb_build_object('success', false, 'error', 'Cette action est restreinte sur votre compte. Contactez le support.'); END IF;
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT user_id, total_htg, payment_status, shipping_prepaid INTO v_user_id, v_total, v_status, v_prepaid
    FROM product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable');
  END IF;
  IF v_status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande déjà payée');
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_balance
    FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable');
  END IF;
  IF v_balance < v_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant');
  END IF;

  IF NOT public.kyc_ok(v_total) THEN
    RETURN jsonb_build_object('success', false, 'code', 'kyc_required',
      'error', 'Vérification d''identité requise pour ce paiement.');
  END IF;

  IF NOT public.mfa_ok(v_total) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required',
      'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_total WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet_id, 'payment', v_total, 'completed',
          CASE WHEN v_prepaid THEN 'Paiement commande produits + expédition #' ELSE 'Paiement commande produits #' END || substr(p_order_id::text, 1, 8));

  UPDATE product_orders
     SET payment_status = 'paid', status = 'processing', tracking_status = 'paid', updated_at = now(),
         shipping_paid_at = CASE WHEN v_prepaid THEN now() ELSE shipping_paid_at END
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Warehouse arrival: a prepaid (all inclusive) catalogue order has nothing left to pay, it goes straight to "shipping paid"
-- (ready to be assigned to an expedition). Other orders behave as before (the customer then chooses a method and pays).
CREATE OR REPLACE FUNCTION public.admin_order_arrived(p_kind text, p_id uuid, p_kg numeric, p_cbm numeric, p_category_slug text DEFAULT 'generic')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat uuid; v_user uuid; v_code text; v_changed boolean; v_link text; v_prepaid boolean := false;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF coalesce(p_kg, 0) <= 0 AND coalesce(p_cbm, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le poids ou le volume réel du colis.');
  END IF;
  IF coalesce(p_kg, 0) < 0 OR coalesce(p_cbm, 0) < 0 OR coalesce(p_kg, 0) > 100000 OR coalesce(p_cbm, 0) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mesures invalides.');
  END IF;
  SELECT id INTO v_cat FROM product_rate_categories WHERE slug = coalesce(p_category_slug, 'generic') AND active = true;
  IF v_cat IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Catégorie de produit invalide.'); END IF;

  IF p_kind = 'order' THEN
    PERFORM 1 FROM orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    SELECT user_id, coalesce(tracking_code, upper(substr(id::text, 1, 8))), status <> 'in_china_warehouse' INTO v_user, v_code, v_changed FROM orders
     WHERE id = p_id AND shipping_option = 'separate' AND shipping_paid_at IS NULL
       AND status IN ('paid', 'purchasing', 'in_china_warehouse');
    IF v_user IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut pas passer à l''entrepôt (expédition séparée payée ou statut incompatible).');
    END IF;
    UPDATE orders SET weight_kg = nullif(p_kg, 0), cbm = nullif(p_cbm, 0), rate_category_id = v_cat,
                      status = 'in_china_warehouse', updated_at = now() WHERE id = p_id;
    v_link := '/orders/' || p_id;
  ELSIF p_kind = 'product_order' THEN
    PERFORM 1 FROM product_orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    SELECT user_id, coalesce(tracking_code, upper(substr(id::text, 1, 8))), shipping_prepaid INTO v_user, v_code, v_prepaid FROM product_orders
     WHERE id = p_id AND payment_status = 'paid'
       AND ((shipping_paid_at IS NULL AND tracking_status IN ('paid', 'purchasing', 'in_china_warehouse'))
            OR (shipping_prepaid AND tracking_status IN ('paid', 'purchasing', 'in_china_warehouse')));
    IF v_user IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut pas passer à l''entrepôt (expédition déjà payée ou statut incompatible).');
    END IF;
    IF v_prepaid THEN
      v_changed := true;
      UPDATE product_orders SET weight_kg = nullif(p_kg, 0), cbm = nullif(p_cbm, 0), rate_category_id = v_cat,
                                tracking_status = 'shipping_paid', received_at = coalesce(received_at, now()), updated_at = now() WHERE id = p_id;
    ELSE
      SELECT tracking_status <> 'in_china_warehouse' INTO v_changed FROM product_orders WHERE id = p_id;
      UPDATE product_orders SET weight_kg = nullif(p_kg, 0), cbm = nullif(p_cbm, 0), rate_category_id = v_cat,
                                tracking_status = 'in_china_warehouse',
                                received_at = coalesce(received_at, now()), updated_at = now() WHERE id = p_id;
    END IF;
    v_link := '/product-orders/' || p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.');
  END IF;

  IF v_changed THEN
    IF v_prepaid THEN
      INSERT INTO notifications (user_id, title, body, title_en, body_en, type, link)
      VALUES (v_user, 'Votre colis est arrivé à l''entrepôt',
        'La commande #' || v_code || ' est arrivée à l''entrepôt. L''expédition est déjà payée : elle partira avec le prochain lot.',
        'Your parcel has arrived at the warehouse',
        'Order #' || v_code || ' has arrived at the warehouse. Shipping is already paid: it will leave with the next batch.',
        'success', v_link);
    ELSE
      INSERT INTO notifications (user_id, title, body, title_en, body_en, type, link)
      VALUES (v_user, 'Votre commande est disponible à l''entrepôt',
        'La commande #' || v_code || ' est arrivée à l''entrepôt. Choisissez votre mode d''expédition : les frais sont calculés directement, puis payez pour lancer l''envoi.',
        'Your order is available at the warehouse',
        'Order #' || v_code || ' has arrived at the warehouse. Choose your shipping method: the fees are calculated right away, then pay to start the shipment.',
        'info', v_link);
    END IF;
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
