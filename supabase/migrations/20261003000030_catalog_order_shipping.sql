-- Catalogue orders are "purchase only" orders: the customer pays the product, and the shipping is paid once the team
-- confirms the parcel arrived at the warehouse (same logic as a quote order with separate shipping, but the product
-- already exists on the app, so there is no link/quote step).
--
--   processing, received_at NULL            : product paid, being bought / brought to the warehouse
--   received_at set, shipping_paid_at NULL   : parcel arrived, the customer must pay the shipping
--   shipping_paid_at set                     : shipping paid, the team can ship it (shipped, then delivered)

ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_amount_htg numeric CHECK (shipping_amount_htg IS NULL OR shipping_amount_htg >= 0),
  ADD COLUMN IF NOT EXISTS shipping_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_note text CHECK (shipping_note IS NULL OR length(shipping_note) <= 300);

-- no shipped / delivered status while the shipping is unpaid
CREATE OR REPLACE FUNCTION public.guard_product_order_shipped()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('shipped', 'delivered') AND NEW.status IS DISTINCT FROM OLD.status AND NEW.shipping_paid_at IS NULL THEN
    RAISE EXCEPTION 'Les frais d''expédition de cette commande ne sont pas payés.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_product_order_shipped() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_product_order_shipped
  BEFORE UPDATE ON public.product_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_order_shipped();

-- The team confirms the parcel arrived and sets the shipping fee (0 = free, nothing to pay).
CREATE OR REPLACE FUNCTION public.admin_product_order_received(p_order_id uuid, p_shipping_htg numeric, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o product_orders%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_shipping_htg IS NULL OR p_shipping_htg < 0 OR p_shipping_htg > 10000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant d''expédition invalide.');
  END IF;
  SELECT * INTO o FROM product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
  IF o.payment_status <> 'paid' OR o.status <> 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut pas être marquée comme arrivée.');
  END IF;
  IF o.received_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Colis déjà marqué comme arrivé.'); END IF;

  UPDATE product_orders
     SET received_at = now(), shipping_amount_htg = p_shipping_htg,
         shipping_note = left(nullif(trim(coalesce(p_note, '')), ''), 300),
         shipping_paid_at = CASE WHEN p_shipping_htg = 0 THEN now() ELSE NULL END,
         updated_at = now()
   WHERE id = p_order_id;

  IF p_shipping_htg = 0 THEN
    PERFORM public.remind(o.user_id, 'Votre colis est arrivé',
      'Votre colis de la commande #' || upper(substr(o.id::text, 1, 8)) || ' est arrivé à l''entrepôt. L''expédition est offerte.',
      'Your package has arrived',
      'The package of order #' || upper(substr(o.id::text, 1, 8)) || ' has arrived at the warehouse. Shipping is free.',
      '/product-orders/' || o.id, 1);
  ELSE
    PERFORM public.remind(o.user_id, 'Votre colis est arrivé : payez l''expédition',
      'Votre colis de la commande #' || upper(substr(o.id::text, 1, 8)) || ' est arrivé à l''entrepôt. Payez l''expédition (' || to_char(p_shipping_htg, 'FM999G999G990') || ' HTG) pour qu''il parte vers Haïti.',
      'Your package has arrived: pay the shipping',
      'The package of order #' || upper(substr(o.id::text, 1, 8)) || ' has arrived at the warehouse. Pay the shipping (' || to_char(p_shipping_htg, 'FM999G999G990') || ' HTG) so it can leave for Haiti.',
      '/product-orders/' || o.id, 1);
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_product_order_received(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_order_received(uuid, numeric, text) TO authenticated;

-- The customer pays the shipping: the amount is the one the team set (never sent by the browser).
CREATE OR REPLACE FUNCTION public.pay_product_order_shipping(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  o         product_orders%ROWTYPE;
  v_wallet  uuid;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  SELECT * INTO o FROM product_orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
  IF o.payment_status <> 'paid' OR o.received_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis n''est pas encore arrivé à l''entrepôt.');
  END IF;
  IF o.shipping_paid_at IS NOT NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Expédition déjà payée.'); END IF;
  IF coalesce(o.shipping_amount_htg, 0) <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Aucune expédition à payer.'); END IF;

  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF v_balance < o.shipping_amount_htg THEN RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant'); END IF;
  IF NOT public.kyc_ok(o.shipping_amount_htg) THEN
    RETURN jsonb_build_object('success', false, 'code', 'kyc_required', 'error', 'Vérification d''identité requise pour ce paiement.');
  END IF;
  IF NOT public.mfa_ok(o.shipping_amount_htg) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required', 'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  UPDATE wallets SET available_balance = available_balance - o.shipping_amount_htg, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', o.shipping_amount_htg, 'completed',
          'Frais d''expédition commande produits #' || substr(p_order_id::text, 1, 8));
  UPDATE product_orders SET shipping_paid_at = now(), updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'paid', o.shipping_amount_htg);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pay_product_order_shipping(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_product_order_shipping(uuid) TO authenticated;

-- A refunded shipping payment re-opens the shipping (the product order itself stays as it is).
DO $$
DECLARE def text := pg_get_functiondef('public.admin_refund_transaction(uuid,text)'::regprocedure);
BEGIN
  def := replace(def,
    E'  UPDATE orders SET payment_status = ''refunded''',
    E'  UPDATE product_orders SET shipping_paid_at = NULL, updated_at = now()\n   WHERE user_id = w.user_id AND shipping_paid_at IS NOT NULL\n     AND t.description = ''Frais d''''expédition commande produits #'' || substr(id::text, 1, 8);\n  UPDATE orders SET payment_status = ''refunded''');
  EXECUTE def;
END $$;
