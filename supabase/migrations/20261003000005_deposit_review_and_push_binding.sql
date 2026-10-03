-- 1. Deposit approval was done from the browser: the wallet was credited but wallet_transactions
--    has no UPDATE policy, so the status silently stayed "pending" (and could be approved twice).
--    Approval/refusal is now one atomic admin-only function.
CREATE OR REPLACE FUNCTION admin_review_deposit(p_tx_id uuid, p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx wallet_transactions%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_tx FROM wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction introuvable.');
  END IF;
  IF v_tx.type <> 'deposit' OR v_tx.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette transaction a déjà été traitée.');
  END IF;

  IF p_approve THEN
    UPDATE wallet_transactions SET status = 'completed' WHERE id = p_tx_id;
    UPDATE wallets SET available_balance = available_balance + v_tx.amount, updated_at = now()
     WHERE id = v_tx.wallet_id;
  ELSE
    UPDATE wallet_transactions SET status = 'cancelled' WHERE id = p_tx_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_approve THEN 'completed' ELSE 'cancelled' END);
END;
$$;

REVOKE ALL ON FUNCTION admin_review_deposit(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_review_deposit(uuid, boolean) TO authenticated;

-- 2. A push endpoint is one browser. It had been registered under three different accounts, so
--    admin notifications reached a client signed in on the same device.
CREATE OR REPLACE FUNCTION register_push_subscription(p_subscription jsonb, p_types text[], p_user_agent text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_endpoint text := p_subscription->>'endpoint';
BEGIN
  IF auth.uid() IS NULL OR v_endpoint IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE push_subscriptions
     SET subscription = jsonb_build_object('endpoint', 'revoked:' || id::text),
         notification_types = '{}',
         updated_at = now()
   WHERE subscription->>'endpoint' = v_endpoint
     AND user_id <> auth.uid();

  UPDATE push_subscriptions
     SET subscription = p_subscription, user_agent = p_user_agent,
         notification_types = p_types, updated_at = now()
   WHERE user_id = auth.uid()
     AND subscription->>'endpoint' = v_endpoint;

  IF NOT FOUND THEN
    INSERT INTO push_subscriptions (user_id, subscription, user_agent, notification_types, updated_at)
    VALUES (auth.uid(), p_subscription, p_user_agent, p_types, now());
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION register_push_subscription(jsonb, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION register_push_subscription(jsonb, text[], text) TO authenticated;

-- One-off repair: endpoints shared by several accounts are revoked (each device re-registers on its next open)
UPDATE push_subscriptions SET subscription = jsonb_build_object('endpoint', 'revoked:' || id::text), notification_types = '{}'
 WHERE subscription->>'endpoint' IN (SELECT subscription->>'endpoint' FROM push_subscriptions GROUP BY 1 HAVING count(DISTINCT user_id) > 1);

-- One-off repair: this deposit had been credited but stayed pending
UPDATE wallet_transactions SET status = 'completed'
 WHERE id = '2d7f6999-e394-4f41-bc4b-b4f5bc21c2cf' AND status = 'pending' AND type = 'deposit';
