-- ============================================================
-- KONVWA — Use shipping_rates (dynamic calculated prices) instead of
-- shipping_methods (fixed prices) for order shipping selection.
-- ============================================================

-- 1. Add chosen_shipping_rate_id to orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS chosen_shipping_rate_id uuid REFERENCES shipping_rates(id);

-- 2. Drop old fixed-price function (different signature → must drop first)
DROP FUNCTION IF EXISTS choose_shipping_method(uuid, uuid);

-- 3. New function: calculates from shipping_rates, charges wallet
CREATE OR REPLACE FUNCTION choose_shipping_method(
  p_order_id            uuid,
  p_shipping_rate_id    uuid,
  p_shipping_amount_htg numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order      orders%ROWTYPE;
  v_rate       shipping_rates%ROWTYPE;
  v_wallet_id  uuid;
  v_balance    numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch & validate order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.');
  END IF;
  IF v_order.status != 'in_china_warehouse' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''est pas prête pour l''expédition.');
  END IF;
  IF v_order.shipping_option != 'separate' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne nécessite pas de choix d''expédition séparé.');
  END IF;
  IF v_order.chosen_shipping_rate_id IS NOT NULL OR v_order.chosen_shipping_method_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un mode d''expédition a déjà été sélectionné.');
  END IF;

  -- Fetch & validate rate
  SELECT * INTO v_rate FROM shipping_rates WHERE id = p_shipping_rate_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tarif d''expédition introuvable ou inactif.');
  END IF;

  -- Validate amount
  IF p_shipping_amount_htg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant d''expédition invalide.');
  END IF;

  -- Check wallet
  SELECT id, available_balance INTO v_wallet_id, v_balance
    FROM wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
  END IF;
  IF v_balance < p_shipping_amount_htg THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant. Veuillez recharger votre portefeuille.');
  END IF;

  -- Deduct
  UPDATE wallets
    SET available_balance = available_balance - p_shipping_amount_htg
    WHERE id = v_wallet_id;

  -- Wallet transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description, reference)
  VALUES (
    v_wallet_id, 'payment', p_shipping_amount_htg, 'completed',
    'Frais d''expédition — ' || v_order.tracking_code || ' (' || v_rate.name || ')',
    v_order.tracking_code
  );

  -- Update order
  UPDATE orders SET
    chosen_shipping_rate_id      = p_shipping_rate_id,
    shipping_method_confirmed_at = now(),
    shipping_amount_paid         = p_shipping_amount_htg,
    shipping_paid_at             = now(),
    total_paid                   = COALESCE(total_paid, 0) + p_shipping_amount_htg,
    status                       = 'shipped'
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success',         true,
    'shipping_amount', p_shipping_amount_htg,
    'rate_name',       v_rate.name
  );
END;
$$;
