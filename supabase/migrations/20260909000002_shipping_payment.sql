-- ── Add shipping payment tracking columns to orders ───────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_amount_paid numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_paid_at     timestamptz;

-- ── Replace choose_shipping_method — now deducts wallet ───────────────────────
CREATE OR REPLACE FUNCTION choose_shipping_method(
  p_order_id           uuid,
  p_shipping_method_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid;
  v_order     orders%ROWTYPE;
  v_method    shipping_methods%ROWTYPE;
  v_wallet_id uuid;
  v_balance   numeric;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.');
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.');
  END IF;
  IF v_order.user_id != v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé.');
  END IF;
  IF v_order.status != 'in_china_warehouse' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La commande n''est pas en entrepôt Chine.');
  END IF;
  IF v_order.shipping_option != 'separate' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''utilise pas l''expédition séparée.');
  END IF;
  IF v_order.chosen_shipping_method_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Une méthode d''expédition a déjà été choisie.');
  END IF;

  SELECT * INTO v_method FROM shipping_methods WHERE id = p_shipping_method_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Méthode d''expédition invalide ou inactive.');
  END IF;

  -- Wallet check
  SELECT id, available_balance INTO v_wallet_id, v_balance
  FROM wallets WHERE user_id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
  END IF;
  IF v_balance < v_method.price_htg THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Solde insuffisant pour payer l''expédition.',
      'balance', v_balance,
      'required', v_method.price_htg
    );
  END IF;

  -- Deduct wallet
  UPDATE wallets
  SET available_balance = available_balance - v_method.price_htg,
      updated_at        = now()
  WHERE id = v_wallet_id;

  -- Wallet transaction
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description, reference)
  VALUES (
    v_wallet_id, 'payment', v_method.price_htg, 'completed',
    'Expédition ' || v_method.name || ' — ' || v_order.tracking_code,
    v_order.tracking_code || '-SHIP'
  );

  -- Update order
  UPDATE orders
  SET
    chosen_shipping_method_id    = p_shipping_method_id,
    shipping_method_confirmed_at = now(),
    shipping_amount_paid         = v_method.price_htg,
    shipping_paid_at             = now(),
    total_paid                   = COALESCE(total_paid, 0) + v_method.price_htg,
    status                       = 'shipped',
    updated_at                   = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'shipping_amount', v_method.price_htg,
    'method_name', v_method.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION choose_shipping_method(uuid, uuid) TO authenticated;
