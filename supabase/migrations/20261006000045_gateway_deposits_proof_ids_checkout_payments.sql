-- 2. Proof identifier (receipt / transfer / transaction number): entered by the team when it checks the proof, kept for good, usable once.
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS proof_id text;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_proof_id_chk CHECK (proof_id IS NULL OR char_length(proof_id) BETWEEN 4 AND 120);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_proof_id_key ON public.wallet_transactions (lower(btrim(proof_id))) WHERE proof_id IS NOT NULL;
-- the reference typed by the client when submitting cannot be reused by another pending / accepted deposit either
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_manual_ref_key ON public.wallet_transactions (lower(btrim(reference)))
  WHERE type = 'deposit' AND payment_method IN ('virement', 'btc', 'usdt', 'eth') AND reference IS NOT NULL AND btrim(reference) <> '' AND status IN ('pending', 'completed');

-- 1. Gateway payments (MonCash / NatCash) are settled only by the gateway's own confirmation, never by the browser or by hand.
--    A client can only submit manual deposits (bank transfer, crypto) and cannot fill the fields the team / the gateway own.
ALTER POLICY users_insert_own_transactions ON public.wallet_transactions WITH CHECK (
  type = 'deposit' AND status = 'pending' AND amount > 0
  AND payment_method IN ('virement', 'btc', 'usdt', 'eth')
  AND proof_id IS NULL AND plop_transaction_id IS NULL AND refund_of IS NULL
  AND EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = (SELECT auth.uid()))
);

-- Rejecting a manual deposit stays possible; approving goes through admin_approve_manual_deposit (proof id required).
CREATE OR REPLACE FUNCTION public.admin_review_deposit(p_tx_id uuid, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx wallet_transactions%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_tx FROM wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;
  IF v_tx.type <> 'deposit' OR v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette transaction a déjà été traitée.');
  END IF;
  IF v_tx.payment_method IN ('moncash', 'natcash') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les paiements MonCash / NatCash sont validés uniquement par la plateforme de paiement.');
  END IF;
  IF p_approve THEN
    RETURN jsonb_build_object('success', false, 'error', 'Validez avec l''identifiant de la preuve de paiement.');
  END IF;
  UPDATE wallet_transactions SET status = 'cancelled' WHERE id = p_tx_id;
  RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_manual_deposit(p_tx_id uuid, p_proof_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tx wallet_transactions%ROWTYPE; v_proof text := btrim(coalesce(p_proof_id, ''));
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF char_length(v_proof) < 4 OR char_length(v_proof) > 120 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saisissez l''identifiant de la preuve (4 à 120 caractères).');
  END IF;
  SELECT * INTO v_tx FROM wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Transaction introuvable.'); END IF;
  IF v_tx.type <> 'deposit' OR v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette transaction a déjà été traitée.');
  END IF;
  IF v_tx.payment_method NOT IN ('virement', 'btc', 'usdt', 'eth') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Les paiements MonCash / NatCash sont validés uniquement par la plateforme de paiement.');
  END IF;
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE lower(btrim(proof_id)) = lower(v_proof) AND id <> p_tx_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'proof_reused', 'error', 'Cet identifiant de preuve a déjà été utilisé : une preuve ne peut servir qu''une fois.');
  END IF;
  UPDATE wallet_transactions SET status = 'completed', proof_id = v_proof WHERE id = p_tx_id;
  UPDATE wallets SET available_balance = available_balance + v_tx.amount, updated_at = now() WHERE id = v_tx.wallet_id;
  RETURN jsonb_build_object('success', true, 'status', 'completed');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'code', 'proof_reused', 'error', 'Cet identifiant de preuve a déjà été utilisé : une preuve ne peut servir qu''une fois.');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_approve_manual_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_approve_manual_deposit(uuid, text) TO authenticated;

-- 3. The admin queue ("pending") and the pending figures only hold what the team can act on: gateway payments still waiting for the
--    customer or the gateway are not in it (they join the history once the gateway has confirmed and the wallet is credited).
CREATE OR REPLACE FUNCTION public.admin_list_transactions(p_status text DEFAULT 'all'::text, p_type text DEFAULT 'all'::text, p_method text DEFAULT 'all'::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, type text, amount numeric, status text, payment_method text, description text, reference text, proof_url text, plop_transaction_id text, created_at timestamp with time zone, wallet_id uuid, refund_of uuid, user_id uuid, customer_name text, customer_phone text, customer_email text, refunded boolean, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s text := nullif(trim(coalesce(p_search, '')), '');
BEGIN
  IF NOT is_admin() THEN RETURN; END IF;
  IF s IS NOT NULL THEN s := '%' || replace(replace(replace(s, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  RETURN QUERY
  SELECT t.id, t.type, t.amount, t.status, t.payment_method, t.description, t.reference, t.proof_url, t.plop_transaction_id,
         t.created_at, t.wallet_id, t.refund_of, w.user_id, p.full_name, p.phone, u.email::text,
         EXISTS (SELECT 1 FROM wallet_transactions r WHERE r.refund_of = t.id), count(*) OVER ()
    FROM wallet_transactions t
    JOIN wallets w ON w.id = t.wallet_id
    LEFT JOIN profiles p ON p.user_id = w.user_id
    LEFT JOIN auth.users u ON u.id = w.user_id
   WHERE (p_status = 'all' OR t.status = p_status)
     AND NOT (p_status = 'pending' AND t.type = 'deposit' AND t.payment_method IN ('moncash', 'natcash'))
     AND (p_type = 'all' OR t.type = p_type)
     AND (p_method = 'all' OR t.payment_method = p_method)
     AND (p_from IS NULL OR t.created_at >= p_from)
     AND (p_to IS NULL OR t.created_at < p_to + 1)
     AND (s IS NULL OR p.full_name ILIKE s OR p.phone ILIKE s OR u.email ILIKE s OR t.reference ILIKE s
          OR t.description ILIKE s OR t.plop_transaction_id ILIKE s OR t.proof_id ILIKE s OR t.id::text ILIKE s)
   ORDER BY t.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 5000) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_payment_stats(p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT is_admin() THEN RETURN '{}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'pending_count', (SELECT count(*) FROM wallet_transactions WHERE status = 'pending' AND NOT (type = 'deposit' AND payment_method IN ('moncash', 'natcash'))),
    'pending_amount', (SELECT coalesce(sum(amount), 0) FROM wallet_transactions WHERE status = 'pending' AND type = 'deposit' AND payment_method NOT IN ('moncash', 'natcash')),
    'deposits', coalesce(sum(amount) FILTER (WHERE type = 'deposit' AND status = 'completed'), 0),
    'deposits_count', count(*) FILTER (WHERE type = 'deposit' AND status = 'completed'),
    'payments', coalesce(sum(amount) FILTER (WHERE type = 'payment' AND status = 'completed'), 0),
    'payments_count', count(*) FILTER (WHERE type = 'payment' AND status = 'completed'),
    'refunds', coalesce(sum(amount) FILTER (WHERE type = 'refund' AND status = 'completed'), 0),
    'withdrawals', coalesce(sum(amount) FILTER (WHERE type = 'withdrawal' AND status = 'completed'), 0),
    'rejected_count', count(*) FILTER (WHERE status IN ('failed', 'cancelled')),
    'by_method', coalesce((SELECT jsonb_agg(m) FROM (
        SELECT coalesce(t2.payment_method, 'autre') AS method, sum(t2.amount) AS amount, count(*) AS count
          FROM wallet_transactions t2
         WHERE t2.type = 'deposit' AND t2.status = 'completed'
           AND (p_from IS NULL OR t2.created_at >= p_from) AND (p_to IS NULL OR t2.created_at < p_to + 1)
         GROUP BY 1 ORDER BY 2 DESC) m), '[]'::jsonb),
    'wallets_total', (SELECT coalesce(sum(available_balance), 0) FROM wallets)
  ) INTO r
  FROM wallet_transactions t
  WHERE (p_from IS NULL OR t.created_at >= p_from) AND (p_to IS NULL OR t.created_at < p_to + 1);
  RETURN r;
END;
$$;

-- 4. Pay the checkout directly with MonCash / NatCash. Nothing is ordered until the gateway confirms the payment:
--    the intent below only remembers what the customer wants to buy; the orders are created (and paid) when the gateway says "ok".
CREATE TABLE IF NOT EXISTS public.checkout_intents (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference        text NOT NULL UNIQUE,
  method           text NOT NULL CHECK (method IN ('moncash', 'natcash')),
  amount           numeric NOT NULL CHECK (amount > 0),
  items            jsonb NOT NULL,
  shipping_rate_id uuid,
  notes            text,
  source           text NOT NULL DEFAULT 'cart' CHECK (source IN ('cart', 'buy_now')),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'order_failed', 'failed')),
  plop_transaction_id text,
  result           jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checkout_intents_user_status ON public.checkout_intents (user_id, status, created_at DESC);
ALTER TABLE public.checkout_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkout_intents_select ON public.checkout_intents FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR is_admin());
REVOKE ALL ON public.checkout_intents FROM anon;
REVOKE ALL ON public.checkout_intents FROM authenticated;
GRANT SELECT ON public.checkout_intents TO authenticated;

-- What the cart costs right now (products + shipping), computed by the real order function inside a transaction that is rolled back.
CREATE OR REPLACE FUNCTION public.quote_checkout(p_items jsonb, p_rate uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  BEGIN
    res := public.create_product_checkout(p_items, p_rate, NULL);
    RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = res::text;
  EXCEPTION
    WHEN SQLSTATE 'P0999' THEN RETURN SQLERRM::jsonb;
    WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.quote_checkout(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_checkout(jsonb, uuid) TO authenticated;

-- Called by the payment-verify Edge Function once the gateway confirmed the payment (service role only).
-- 1) the money is credited to the wallet and recorded, 2) the orders are created and paid from it, all or nothing.
-- If the orders cannot be placed (price or stock changed…) the money stays in the wallet and the intent says why.
CREATE OR REPLACE FUNCTION public.fulfill_checkout_intent(p_reference text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i checkout_intents%ROWTYPE; w uuid; res jsonb; o jsonb; pay jsonb; out jsonb;
BEGIN
  SELECT * INTO i FROM checkout_intents WHERE reference = p_reference FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable.'); END IF;
  IF i.status IN ('completed', 'order_failed') THEN RETURN coalesce(i.result, '{}'::jsonb) || jsonb_build_object('already', true); END IF;

  SELECT id INTO w FROM wallets WHERE user_id = i.user_id FOR UPDATE;
  IF w IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  UPDATE wallets SET available_balance = available_balance + i.amount, updated_at = now() WHERE id = w;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, reference, plop_transaction_id, description)
  VALUES (w, 'deposit', i.amount, 'completed', i.method, i.reference, i.plop_transaction_id,
          'Paiement de commande ' || CASE i.method WHEN 'moncash' THEN 'MonCash' ELSE 'NatCash' END);

  -- the customer's identity checks (MFA code, ID) were enforced when the payment was started
  PERFORM set_config('request.jwt.claims', json_build_object('sub', i.user_id, 'role', 'authenticated', 'aal', 'aal2',
    'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch FROM now())::bigint)))::text, true);
  BEGIN
    res := public.create_product_checkout(i.items, i.shipping_rate_id, i.notes);
    IF NOT coalesce((res ->> 'success')::boolean, false) THEN RAISE EXCEPTION '%', coalesce(res ->> 'error', 'Commande impossible'); END IF;
    FOR o IN SELECT * FROM jsonb_array_elements(res -> 'orders') LOOP
      pay := public.pay_product_order((o ->> 'order_id')::uuid);
      IF NOT coalesce((pay ->> 'success')::boolean, false) THEN RAISE EXCEPTION '%', coalesce(pay ->> 'error', 'Paiement refusé'); END IF;
    END LOOP;
    out := jsonb_build_object('success', true, 'orders', res -> 'orders', 'total', res -> 'total', 'source', i.source);
    UPDATE checkout_intents SET status = 'completed', result = out, updated_at = now() WHERE id = i.id;
    RETURN out;
  EXCEPTION WHEN OTHERS THEN
    out := jsonb_build_object('success', false, 'credited', i.amount, 'error', SQLERRM, 'source', i.source);
    UPDATE checkout_intents SET status = 'order_failed', result = out, updated_at = now() WHERE id = i.id;
    RETURN out;
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.fulfill_checkout_intent(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_checkout_intent(text) TO service_role;
