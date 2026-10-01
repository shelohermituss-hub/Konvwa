-- RPC callable by the authenticated client to pay their shipping quote
-- The quote must be in status 'quoted' and wallet balance must cover it.

CREATE OR REPLACE FUNCTION pay_shipping_quote(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req       product_requests%ROWTYPE;
  v_wallet_id uuid;
  v_balance   numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF v_req.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;
  IF v_req.request_type != 'shipping' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de demande invalide.');
  END IF;
  IF v_req.status != 'quoted' THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Statut incompatible — le devis doit être à l''état "Devis envoyé".');
  END IF;
  IF v_req.quoted_amount_htg IS NULL OR v_req.quoted_amount_htg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant du devis introuvable.');
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_balance
    FROM wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
  END IF;
  IF v_balance < v_req.quoted_amount_htg THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible).');
  END IF;

  UPDATE wallets
    SET available_balance = available_balance - v_req.quoted_amount_htg
    WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (
    v_wallet_id, 'payment', v_req.quoted_amount_htg, 'completed',
    'Frais d''expédition — demande #' || left(p_request_id::text, 8)
  );

  UPDATE product_requests SET
    status            = 'invoiced',
    actual_amount_htg = quoted_amount_htg,
    invoiced_at       = now(),
    updated_at        = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_req.user_id,
    'Paiement confirmé',
    'Votre paiement de ' || to_char(v_req.quoted_amount_htg, 'FM999,999,990') || ' HTG a été effectué.',
    'info',
    '/expeditions'
  );

  RETURN jsonb_build_object('success', true, 'amount_htg', v_req.quoted_amount_htg);
END;
$$;

GRANT EXECUTE ON FUNCTION pay_shipping_quote(uuid) TO authenticated;
