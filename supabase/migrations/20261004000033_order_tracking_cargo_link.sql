-- Catalogue orders and separate-shipping orders follow the normal order journey (a catalogue order simply starts at "Payé"),
-- and they are LINKED to the shipping request (cargo) that carries them, so the team always knows which order a cargo belongs to.
--
--  * At the warehouse the team enters the real weight / CBM. The customer is notified, picks a shipping method (fees are computed
--    by the database from the rate grid) and pays. Paying creates a PAID shipping request linked to the order.
--  * The cargo status is editable by the team after the customer has paid; the linked order follows it.
--  * A "demande d'expédition" created by the customer stays for a customer who sends their OWN parcel to the warehouses.
-- Nothing in this file drops anything (the SQL tooling refuses DROP): obsolete functions are simply revoked.

-- 1. Columns -------------------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS weight_kg numeric CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS cbm numeric CHECK (cbm IS NULL OR cbm >= 0),
  ADD COLUMN IF NOT EXISTS rate_category_id uuid REFERENCES public.product_rate_categories(id),
  ADD COLUMN IF NOT EXISTS shipping_request_id uuid REFERENCES public.product_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_shipping_request_uidx ON public.orders (shipping_request_id) WHERE shipping_request_id IS NOT NULL;

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS tracking_status text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric CHECK (weight_kg IS NULL OR weight_kg >= 0),
  ADD COLUMN IF NOT EXISTS cbm numeric CHECK (cbm IS NULL OR cbm >= 0),
  ADD COLUMN IF NOT EXISTS rate_category_id uuid REFERENCES public.product_rate_categories(id),
  ADD COLUMN IF NOT EXISTS chosen_shipping_rate_id uuid REFERENCES public.shipping_rates(id);

ALTER TABLE public.product_requests
  ADD COLUMN IF NOT EXISTS tracking_status text,
  ADD COLUMN IF NOT EXISTS source_order_kind text,
  ADD COLUMN IF NOT EXISTS source_order_id uuid,
  ADD COLUMN IF NOT EXISTS source_order_label text;

ALTER TABLE public.product_orders
  ADD CONSTRAINT product_orders_tracking_status_check CHECK (tracking_status IS NULL OR tracking_status IN
    ('paid','purchasing','in_china_warehouse','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered'));
ALTER TABLE public.product_requests
  ADD CONSTRAINT product_requests_tracking_status_check CHECK (tracking_status IS NULL OR tracking_status IN
    ('in_china_warehouse','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered')),
  ADD CONSTRAINT product_requests_source_order_kind_check CHECK (source_order_kind IS NULL OR source_order_kind IN ('order','product_order'));

CREATE INDEX IF NOT EXISTS product_requests_source_order_idx ON public.product_requests (source_order_id) WHERE source_order_id IS NOT NULL;

-- Existing catalogue orders: the journey starts at "Payé"
UPDATE public.product_orders SET tracking_status = CASE
    WHEN status = 'delivered' THEN 'delivered'
    WHEN status = 'shipped' THEN 'shipped'
    WHEN received_at IS NOT NULL THEN 'in_china_warehouse'
    ELSE 'paid' END
  WHERE payment_status = 'paid' AND status <> 'cancelled' AND tracking_status IS NULL;

-- 2. Paying a catalogue order puts it at "Payé" --------------------------------------------------
DO $$
DECLARE
  def text := pg_get_functiondef('public.pay_product_order(uuid)'::regprocedure);
  new_def text;
BEGIN
  new_def := replace(def, E'SET payment_status = ''paid'', status = ''processing'', updated_at = now()',
                          E'SET payment_status = ''paid'', status = ''processing'', tracking_status = ''paid'', updated_at = now()');
  IF new_def = def THEN RAISE EXCEPTION 'pay_product_order: pattern not found'; END IF;
  EXECUTE new_def;
END $$;

-- 3. Shipping fee grid: computed by the database, never by the browser ----------------------------
-- Ocean: the greater of the volume price and the weight price; air: weight price; then the minimum charge of the rate.
CREATE OR REPLACE FUNCTION public.shipping_options_for(p_kg numeric, p_cbm numeric, p_category uuid)
RETURNS TABLE (rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH cfg AS (
    SELECT coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140) AS usd,
           coalesce((SELECT rate_multiplier FROM product_rate_categories WHERE id = p_category), 1) AS mult
  )
  SELECT r.id, r.name, r.mode, r.transit_days_min::integer, r.transit_days_max::integer, r.description,
         round(greatest(coalesce(r.min_amount_usd, 0),
                        coalesce(r.base_fee_usd, 0)
                        + CASE WHEN r.mode = 'ocean'
                               THEN greatest(coalesce(r.per_cbm_usd, 0) * coalesce(p_cbm, 0), coalesce(r.per_kg_usd, 0) * coalesce(p_kg, 0))
                               ELSE coalesce(r.per_kg_usd, 0) * coalesce(p_kg, 0) END)
               * cfg.mult * cfg.usd) AS amount_htg
    FROM shipping_rates r, cfg
   WHERE r.active = true
     AND (coalesce(p_kg, 0) > 0 OR coalesce(p_cbm, 0) > 0)
     AND (r.mode = 'ocean' OR coalesce(p_kg, 0) > 0)
     AND (r.max_weight_kg IS NULL OR coalesce(p_kg, 0) <= r.max_weight_kg)
   ORDER BY r.sort_order, r.name;
$$;
REVOKE EXECUTE ON FUNCTION public.shipping_options_for(numeric, numeric, uuid) FROM PUBLIC, anon, authenticated;

-- Options shown to the customer (owner) or the team
CREATE OR REPLACE FUNCTION public.order_shipping_options(p_kind text, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_kg numeric; v_cbm numeric; v_cat uuid; v_ready boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  IF p_kind = 'order' THEN
    SELECT user_id, weight_kg, cbm, rate_category_id, (status = 'in_china_warehouse' AND shipping_option = 'separate' AND shipping_request_id IS NULL)
      INTO v_user, v_kg, v_cbm, v_cat, v_ready FROM orders WHERE id = p_id;
  ELSIF p_kind = 'product_order' THEN
    SELECT user_id, weight_kg, cbm, rate_category_id, (tracking_status = 'in_china_warehouse' AND shipping_request_id IS NULL)
      INTO v_user, v_kg, v_cbm, v_cat, v_ready FROM product_orders WHERE id = p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.');
  END IF;
  IF v_user IS NULL OR (v_user <> auth.uid() AND NOT is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.');
  END IF;
  RETURN jsonb_build_object('success', true, 'ready', coalesce(v_ready, false), 'weight_kg', v_kg, 'cbm', v_cbm,
    'options', coalesce((SELECT jsonb_agg(to_jsonb(o)) FROM shipping_options_for(v_kg, v_cbm, v_cat) o), '[]'::jsonb));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.order_shipping_options(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.order_shipping_options(text, uuid) TO authenticated;

-- 4. Team: the parcel is available at the warehouse (enters the real weight / volume) -----------------
CREATE OR REPLACE FUNCTION public.admin_order_arrived(
  p_kind text, p_id uuid, p_kg numeric, p_cbm numeric, p_category_slug text DEFAULT 'generic')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat uuid; v_user uuid; v_code text; v_changed boolean; v_link text;
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
     WHERE id = p_id AND shipping_option = 'separate' AND shipping_paid_at IS NULL AND shipping_request_id IS NULL
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
    SELECT user_id, coalesce(tracking_code, upper(substr(id::text, 1, 8))), tracking_status <> 'in_china_warehouse' INTO v_user, v_code, v_changed FROM product_orders
     WHERE id = p_id AND payment_status = 'paid' AND shipping_request_id IS NULL
       AND tracking_status IN ('paid', 'purchasing', 'in_china_warehouse');
    IF v_user IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut pas passer à l''entrepôt (expédition déjà payée ou statut incompatible).');
    END IF;
    UPDATE product_orders SET weight_kg = nullif(p_kg, 0), cbm = nullif(p_cbm, 0), rate_category_id = v_cat,
                              tracking_status = 'in_china_warehouse',
                              received_at = coalesce(received_at, now()), updated_at = now() WHERE id = p_id;
    v_link := '/product-orders/' || p_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.');
  END IF;

  IF v_changed THEN
    INSERT INTO notifications (user_id, title, body, title_en, body_en, type, link)
    VALUES (v_user, 'Votre commande est disponible à l''entrepôt',
      'La commande #' || v_code || ' est arrivée à l''entrepôt. Choisissez votre mode d''expédition : les frais sont calculés directement, puis payez pour lancer l''envoi.',
      'Your order is available at the warehouse',
      'Order #' || v_code || ' has arrived at the warehouse. Choose your shipping method: the fees are calculated right away, then pay to start the shipment.',
      'info', v_link);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_order_arrived(text, uuid, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_order_arrived(text, uuid, numeric, numeric, text) TO authenticated;

-- Team: catalogue order status before the warehouse (paid <-> purchasing)
CREATE OR REPLACE FUNCTION public.admin_set_product_order_status(p_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_status NOT IN ('paid', 'purchasing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut invalide : les étapes suivantes viennent de l''entrepôt et de la cargaison.');
  END IF;
  PERFORM 1 FROM product_orders WHERE id = p_id AND payment_status = 'paid' AND tracking_status IN ('paid', 'purchasing') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut plus changer d''étape ici.'); END IF;
  UPDATE product_orders SET tracking_status = p_status, updated_at = now() WHERE id = p_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_product_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_order_status(uuid, text) TO authenticated;

-- 5. Customer: picks the shipping method, the fees are computed here, pays from the wallet --------
CREATE OR REPLACE FUNCTION public.pay_order_shipping(p_kind text, p_id uuid, p_rate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid; v_code text; v_label text; v_kg numeric; v_cbm numeric; v_cat uuid; v_received timestamptz;
  v_opt record; v_wallet uuid; v_balance numeric; v_req uuid; v_ref text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;

  IF p_kind = 'order' THEN
    SELECT user_id, tracking_code, weight_kg, cbm, rate_category_id INTO v_user, v_code, v_kg, v_cbm, v_cat
      FROM orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_user <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    PERFORM 1 FROM orders WHERE id = p_id AND status = 'in_china_warehouse' AND shipping_option = 'separate'
        AND shipping_request_id IS NULL AND shipping_paid_at IS NULL;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''est pas prête pour l''expédition (ou déjà payée).'); END IF;
    v_received := now();
  ELSIF p_kind = 'product_order' THEN
    SELECT user_id, tracking_code, weight_kg, cbm, rate_category_id, received_at INTO v_user, v_code, v_kg, v_cbm, v_cat, v_received
      FROM product_orders WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_user <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
    PERFORM 1 FROM product_orders WHERE id = p_id AND payment_status = 'paid' AND tracking_status = 'in_china_warehouse'
        AND shipping_request_id IS NULL;
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

  -- the paid shipping request (cargo) linked to the order
  INSERT INTO product_requests (
    user_id, request_type, status, product_url, product_name, category, quantity, source_platform,
    notes, product_rate_category_id, actual_kg, actual_cbm, quoted_amount_htg, actual_amount_htg, paid_amount_htg,
    payment_plan, quoted_rate_id, shipping_rate_id, quoted_at, received_at, invoiced_at,
    tracking_status, source_order_kind, source_order_id, source_order_label
  ) VALUES (
    v_user, 'shipping', 'invoiced', '', v_label, 'other', 1, 'other',
    'Expédition de ' || v_label, v_cat, v_kg, v_cbm, v_opt.amount_htg, v_opt.amount_htg, v_opt.amount_htg,
    'full', p_rate_id, p_rate_id, now(), coalesce(v_received, now()), now(),
    'in_china_warehouse', p_kind, p_id, v_label
  ) RETURNING id INTO v_req;

  IF p_kind = 'order' THEN
    UPDATE orders SET chosen_shipping_rate_id = p_rate_id, shipping_method_confirmed_at = now(),
           shipping_amount_paid = v_opt.amount_htg, shipping_paid_at = now(), shipping_request_id = v_req,
           total_paid = coalesce(total_paid, 0) + v_opt.amount_htg, updated_at = now()
     WHERE id = p_id;
  ELSE
    UPDATE product_orders SET chosen_shipping_rate_id = p_rate_id, shipping_amount_htg = v_opt.amount_htg,
           shipping_paid_at = now(), shipping_request_id = v_req, updated_at = now()
     WHERE id = p_id;
  END IF;

  PERFORM notify_once(v_user, 'success', 'Expédition payée — ' || v_label,
    'Votre paiement de ' || to_char(v_opt.amount_htg, 'FM999,999,990') || ' HTG (' || v_opt.name || ') est confirmé. Votre colis va partir.',
    CASE WHEN p_kind = 'order' THEN '/orders/' ELSE '/product-orders/' END || p_id, jsonb_build_object('request_id', v_req));
  PERFORM notify_once(uid, 'info', 'Expédition payée — ' || v_label,
    to_char(v_opt.amount_htg, 'FM999,999,990') || ' HTG reçus (' || v_opt.name || '). À mettre dans une cargaison.',
    '/admin/shipping-requests?open=' || v_req, jsonb_build_object('request_id', v_req))
    FROM get_admin_user_ids() AS uid;

  RETURN jsonb_build_object('success', true, 'amount', v_opt.amount_htg, 'rate_name', v_opt.name, 'request_id', v_req);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pay_order_shipping(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_order_shipping(text, uuid, uuid) TO authenticated;

-- 6. Team: cargo status, editable once the customer has paid ---------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_cargo_status(p_request_id uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r product_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_status NOT IN ('in_china_warehouse','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut de cargaison invalide.');
  END IF;
  SELECT * INTO r FROM product_requests WHERE id = p_request_id AND request_type = 'shipping' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.'); END IF;
  IF r.status NOT IN ('invoiced', 'deposit_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le client doit d''abord payer cette expédition.');
  END IF;
  UPDATE product_requests SET tracking_status = p_status, updated_at = now() WHERE id = p_request_id;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_cargo_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_cargo_status(uuid, text) TO authenticated;

-- 7. Guards and propagation ---------------------------------------------------------------------------
-- cargo requests: only the team (or a definer function) writes the tracking / link columns; no departure before payment
CREATE OR REPLACE FUNCTION public.guard_request_tracking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.tracking_status := OLD.tracking_status; NEW.source_order_kind := OLD.source_order_kind;
      NEW.source_order_id := OLD.source_order_id; NEW.source_order_label := OLD.source_order_label;
    ELSE
      NEW.tracking_status := NULL; NEW.source_order_kind := NULL; NEW.source_order_id := NULL; NEW.source_order_label := NULL;
    END IF;
  END IF;
  -- assigning a paid cargo to a batch makes it follow the batch status
  IF TG_OP = 'UPDATE' AND NEW.shipment_id IS NOT NULL AND NEW.shipment_id IS DISTINCT FROM OLD.shipment_id
     AND NEW.status IN ('invoiced', 'deposit_paid') AND NEW.tracking_status IS NOT DISTINCT FROM OLD.tracking_status THEN
    NEW.tracking_status := (SELECT status FROM shipments WHERE id = NEW.shipment_id);
  END IF;
  IF NEW.tracking_status IS NOT NULL AND NEW.tracking_status <> 'in_china_warehouse'
     AND (TG_OP = 'INSERT' OR NEW.tracking_status IS DISTINCT FROM OLD.tracking_status)
     AND NEW.status NOT IN ('invoiced', 'deposit_paid') THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_request_tracking() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_request_tracking
  BEFORE INSERT OR UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_tracking();

-- a cargo's tracking status drives the linked order(s)
CREATE OR REPLACE FUNCTION public.sync_orders_with_cargo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tracking_status IS NOT NULL AND NEW.tracking_status IS DISTINCT FROM OLD.tracking_status THEN
    UPDATE orders SET status = NEW.tracking_status, updated_at = now()
     WHERE shipping_request_id = NEW.id AND status NOT IN ('cancelled', 'closed') AND status <> NEW.tracking_status;
    UPDATE product_orders SET tracking_status = NEW.tracking_status, updated_at = now()
     WHERE shipping_request_id = NEW.id AND status <> 'cancelled' AND tracking_status IS DISTINCT FROM NEW.tracking_status;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_orders_with_cargo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_sync_orders_with_cargo
  AFTER UPDATE OF tracking_status ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_orders_with_cargo();

-- a batch drives its paid cargos (which drive their orders)
CREATE OR REPLACE FUNCTION public.sync_product_orders_with_shipment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE product_requests SET tracking_status = NEW.status, updated_at = now()
     WHERE shipment_id = NEW.id AND request_type = 'shipping' AND status IN ('invoiced', 'deposit_paid')
       AND tracking_status IS DISTINCT FROM NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- catalogue orders: status mirrors the tracking; nothing leaves before the shipping is paid; orders (separate shipping) likewise
CREATE OR REPLACE FUNCTION public.guard_product_order_tracking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status AND NEW.tracking_status IN
     ('shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') AND NEW.shipping_paid_at IS NULL THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status AND NEW.status <> 'cancelled' AND NEW.payment_status = 'paid' THEN
    NEW.status := CASE
      WHEN NEW.tracking_status = 'delivered' THEN 'delivered'
      WHEN NEW.tracking_status IN ('shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery') THEN 'shipped'
      ELSE 'processing' END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_product_order_tracking() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_product_order_tracking
  BEFORE UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_order_tracking();

CREATE OR REPLACE FUNCTION public.guard_separate_shipping_paid()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.shipping_option = 'separate' AND NEW.shipping_paid_at IS NULL
     AND NEW.status IN ('shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_separate_shipping_paid() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_separate_shipping_paid
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_separate_shipping_paid();

-- 8. Obsolete entry points (they trusted a fee typed by the browser / the team) are no longer callable ------------
REVOKE EXECUTE ON FUNCTION public.choose_shipping_method(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_product_order_received(uuid, uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
