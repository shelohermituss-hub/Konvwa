-- Separate-shipping and catalogue orders are NOT linked to a "cargaison" (shipping request): once the customer has paid the shipping
-- the team simply assigns the ORDER to an expedition (batch, table `shipments`), and the order follows the batch status.
-- Shipping requests ("cargaisons") are only for customers sending their own goods to the warehouses.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;
ALTER TABLE public.product_orders ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_shipment_idx ON public.orders (shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_orders_shipment_idx ON public.product_orders (shipment_id) WHERE shipment_id IS NOT NULL;

-- orders that were linked to a cargo by the previous version keep their batch
UPDATE public.orders o SET shipment_id = pr.shipment_id FROM public.product_requests pr
 WHERE pr.id = o.shipping_request_id AND pr.shipment_id IS NOT NULL AND o.shipment_id IS NULL;
UPDATE public.product_orders o SET shipment_id = pr.shipment_id FROM public.product_requests pr
 WHERE pr.id = o.shipping_request_id AND pr.shipment_id IS NOT NULL AND o.shipment_id IS NULL;

-- readiness no longer depends on a shipping request
DO $$
DECLARE def text; new_def text;
BEGIN
  FOREACH def IN ARRAY ARRAY[pg_get_functiondef('public.order_shipping_options(text,uuid)'::regprocedure), pg_get_functiondef('public.admin_order_arrived(text,uuid,numeric,numeric,text)'::regprocedure)] LOOP
    new_def := replace(replace(def, 'AND shipping_request_id IS NULL', 'AND shipping_paid_at IS NULL'), 'shipping_option = ''separate'' AND shipping_paid_at IS NULL AND shipping_paid_at IS NULL', 'shipping_option = ''separate'' AND shipping_paid_at IS NULL');
    IF new_def = def THEN RAISE EXCEPTION 'pattern not found'; END IF;
    EXECUTE new_def;
  END LOOP;
END $$;

-- paying the shipping: fees computed here, wallet debited, the order goes to "shipping_paid" (no cargo record)
CREATE OR REPLACE FUNCTION public.pay_order_shipping(p_kind text, p_id uuid, p_rate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_code text; v_label text; v_kg numeric; v_cbm numeric; v_cat uuid;
  v_opt record; v_wallet uuid; v_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;

  IF p_kind = 'order' THEN
    SELECT user_id, tracking_code, weight_kg, cbm, rate_category_id INTO v_user, v_code, v_kg, v_cbm, v_cat
      FROM orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_user <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    PERFORM 1 FROM orders WHERE id = p_id AND status = 'in_china_warehouse' AND shipping_option = 'separate' AND shipping_paid_at IS NULL;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''est pas prête pour l''expédition (ou déjà payée).'); END IF;
  ELSIF p_kind = 'product_order' THEN
    SELECT user_id, tracking_code, weight_kg, cbm, rate_category_id INTO v_user, v_code, v_kg, v_cbm, v_cat
      FROM product_orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_user <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    PERFORM 1 FROM product_orders WHERE id = p_id AND payment_status = 'paid' AND tracking_status = 'in_china_warehouse' AND shipping_paid_at IS NULL;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''est pas prête pour l''expédition (ou déjà payée).'); END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.');
  END IF;

  v_code := coalesce(v_code, upper(substr(p_id::text, 1, 8)));
  v_label := CASE WHEN p_kind = 'order' THEN 'Commande ' ELSE 'Catalogue ' END || v_code;

  SELECT * INTO v_opt FROM shipping_options_for(v_kg, v_cbm, v_cat) WHERE rate_id = p_rate_id;
  IF NOT FOUND OR v_opt.amount_htg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode d''expédition indisponible pour ce colis.');
  END IF;

  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF v_balance < v_opt.amount_htg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant. Veuillez recharger votre portefeuille.');
  END IF;
  IF NOT public.kyc_ok(v_opt.amount_htg) THEN
    RETURN jsonb_build_object('success', false, 'code', 'kyc_required', 'error', 'Vérification d''identité requise pour ce paiement.');
  END IF;
  IF NOT public.mfa_ok(v_opt.amount_htg) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required', 'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_opt.amount_htg, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description, reference)
  VALUES (v_wallet, 'payment', v_opt.amount_htg, 'completed',
          'Frais d''expédition — ' || v_label || ' (' || v_opt.name || ')', v_code);

  IF p_kind = 'order' THEN
    UPDATE orders SET chosen_shipping_rate_id = p_rate_id, shipping_method_confirmed_at = now(),
           shipping_amount_paid = v_opt.amount_htg, shipping_paid_at = now(), status = 'shipping_paid',
           total_paid = coalesce(total_paid, 0) + v_opt.amount_htg, updated_at = now()
     WHERE id = p_id;
  ELSE
    UPDATE product_orders SET tracking_status = 'shipping_paid', chosen_shipping_rate_id = p_rate_id,
           shipping_amount_htg = v_opt.amount_htg, shipping_paid_at = now(), updated_at = now()
     WHERE id = p_id;
  END IF;

  PERFORM notify_once(v_user, 'success', 'Expédition payée — ' || v_label,
    'Votre paiement de ' || to_char(v_opt.amount_htg, 'FM999,999,990') || ' HTG (' || v_opt.name || ') est confirmé. Votre colis va partir.',
    CASE WHEN p_kind = 'order' THEN '/orders/' ELSE '/product-orders/' END || p_id, jsonb_build_object('order_id', p_id));
  PERFORM notify_once(uid, 'info', 'Expédition payée — ' || v_label,
    to_char(v_opt.amount_htg, 'FM999,999,990') || ' HTG reçus (' || v_opt.name || '). À assigner à une expédition.',
    CASE WHEN p_kind = 'order' THEN '/admin/orders' ELSE '/admin/product-orders' END, jsonb_build_object('order_id', p_id))
    FROM get_admin_user_ids() AS uid;

  RETURN jsonb_build_object('success', true, 'amount', v_opt.amount_htg, 'rate_name', v_opt.name);
END;
$$;

-- the team assigns the ORDER to an expedition; the order takes the batch status (not left yet = "shipping_paid")
CREATE OR REPLACE FUNCTION public.admin_assign_order_to_batch(p_kind text, p_id uuid, p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_shipment_id IS NOT NULL THEN
    SELECT CASE WHEN status = 'in_china_warehouse' THEN 'shipping_paid' ELSE status END INTO v_status FROM shipments WHERE id = p_shipment_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable.'); END IF;
  END IF;
  IF p_kind = 'order' THEN
    PERFORM 1 FROM orders WHERE id = p_id AND shipping_paid_at IS NOT NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Le client doit d''abord payer l''expédition de cette commande.'); END IF;
    UPDATE orders SET shipment_id = p_shipment_id, updated_at = now(),
           status = CASE WHEN status IN ('cancelled', 'closed') THEN status ELSE coalesce(v_status, status) END WHERE id = p_id;
  ELSIF p_kind = 'product_order' THEN
    PERFORM 1 FROM product_orders WHERE id = p_id AND shipping_paid_at IS NOT NULL FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Le client doit d''abord payer l''expédition de cette commande.'); END IF;
    UPDATE product_orders SET shipment_id = p_shipment_id, updated_at = now(),
           tracking_status = CASE WHEN status = 'cancelled' THEN tracking_status ELSE coalesce(v_status, tracking_status) END WHERE id = p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- a batch drives its paid cargos AND the orders assigned to it
CREATE OR REPLACE FUNCTION public.sync_product_orders_with_shipment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := CASE WHEN NEW.status = 'in_china_warehouse' THEN 'shipping_paid' ELSE NEW.status END;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE product_requests SET tracking_status = v, updated_at = now()
     WHERE shipment_id = NEW.id AND request_type = 'shipping' AND status IN ('invoiced', 'deposit_paid')
       AND tracking_status IS DISTINCT FROM v;
    UPDATE orders SET status = v, updated_at = now()
     WHERE shipment_id = NEW.id AND shipping_paid_at IS NOT NULL AND status NOT IN ('cancelled', 'closed') AND status <> v;
    UPDATE product_orders SET tracking_status = v, updated_at = now()
     WHERE shipment_id = NEW.id AND shipping_paid_at IS NOT NULL AND status <> 'cancelled' AND tracking_status IS DISTINCT FROM v;
  END IF;
  RETURN NEW;
END;
$$;

-- catalogue order status chosen by the team: before the warehouse (paid / purchasing) or, once the shipping is paid, along the journey
CREATE OR REPLACE FUNCTION public.admin_set_product_order_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o product_orders%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  SELECT * INTO o FROM product_orders WHERE id = p_id AND payment_status = 'paid' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut plus changer d''étape ici.'); END IF;
  IF p_status IN ('paid', 'purchasing') AND o.tracking_status IN ('paid', 'purchasing') THEN
    NULL;
  ELSIF p_status IN ('shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') AND o.shipping_paid_at IS NOT NULL THEN
    NULL;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide : les étapes suivantes viennent de l''entrepôt et de la cargaison.');
  END IF;
  UPDATE product_orders SET tracking_status = p_status, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
