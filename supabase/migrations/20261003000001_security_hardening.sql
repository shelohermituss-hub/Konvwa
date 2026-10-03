-- ============================================================
-- KONVWA — security hardening found during the audit
--
-- 1. Users could raise their own wallet balance / role / request amounts through
--    the REST API (UPDATE policies were "own row" with no column restriction).
-- 2. increment_wallet_balance() (no auth check) was callable by anyone with the anon key.
-- 3. pay_product_order() trusted the order's user instead of the caller and could be
--    run twice on the same order.
-- ============================================================

-- ── 1. Functions ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION increment_wallet_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pay_product_order(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   uuid;
  v_total     numeric;
  v_status    text;
  v_balance   numeric;
  v_wallet_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié');
  END IF;

  SELECT user_id, total_htg, payment_status INTO v_user_id, v_total, v_status
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

  UPDATE wallets SET available_balance = available_balance - v_total WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet_id, 'payment', v_total, 'completed',
          'Paiement commande produits #' || substr(p_order_id::text, 1, 8));

  UPDATE product_orders
     SET payment_status = 'paid', status = 'processing', updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Anonymous visitors never need any of these
REVOKE EXECUTE ON FUNCTION
  accept_quote(uuid), reject_quote(uuid), pay_order(uuid), pay_product_order(uuid),
  is_admin(), shipping_terms(), shipping_payment_summary(uuid), pay_shipping_quote(uuid),
  pay_shipping_quote(uuid, text), pay_shipping_balance(uuid)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  admin_invoice_shipment(uuid, numeric), admin_mark_shipping_received(uuid, text),
  admin_mark_shipping_reviewing(uuid, text), admin_collect_shipping_balance(uuid, text),
  admin_send_shipping_quote(uuid, numeric, numeric, numeric, uuid, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION
  choose_shipping_method(uuid, uuid), choose_shipping_method(uuid, uuid, numeric),
  request_shipping_quote(text, uuid, text, integer, numeric, numeric),
  request_shipping_quote(text, uuid, text, integer, numeric, numeric, text, text)
  FROM PUBLIC, anon;

-- Trigger functions are never meant to be called through the API
REVOKE EXECUTE ON FUNCTION
  auto_notify_deposit_confirmed(), auto_notify_new_order(), auto_notify_wallet_transaction(),
  handle_new_user(), notify_push_on_insert(), notify_push_on_notification()
  FROM PUBLIC, anon, authenticated;

-- Pin search_path on the functions the linter flagged
ALTER FUNCTION is_admin() SET search_path = public;
ALTER FUNCTION update_updated_at() SET search_path = public;
ALTER FUNCTION notify_push_on_insert() SET search_path = public;
ALTER FUNCTION notify_push_on_notification() SET search_path = public;
ALTER FUNCTION get_admin_user_ids() SET search_path = public;
ALTER FUNCTION auto_notify_new_order() SET search_path = public;
ALTER FUNCTION auto_notify_wallet_transaction() SET search_path = public;
ALTER FUNCTION auto_notify_deposit_confirmed() SET search_path = public;
ALTER FUNCTION notify_once(uuid, text, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION shipping_late_days(timestamptz) SET search_path = public;
ALTER FUNCTION order_status_for_shipment(text) SET search_path = public;

-- ── 2. Row-level security ────────────────────────────────────
-- Users must never be able to change their own role
CREATE OR REPLACE FUNCTION guard_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.role := OLD.role;
    ELSE
      NEW.role := 'client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_profile_role
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_role();

-- Balances only move through the payment RPCs (SECURITY DEFINER) or an admin
ALTER POLICY users_update_own_wallet ON wallets
  USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY users_insert_own_wallet ON wallets
  WITH CHECK (auth.uid() = user_id AND available_balance = 0 AND blocked_balance = 0);

-- A client can only file a pending deposit
ALTER POLICY users_insert_own_transactions ON wallet_transactions
  WITH CHECK (
    type = 'deposit' AND status = 'pending' AND amount > 0
    AND EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  );

-- Requests and quotes: status/amounts are changed by admins or RPCs only
ALTER POLICY users_update_own_requests ON product_requests
  USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY users_update_own_quotes ON quotes
  USING (is_admin()) WITH CHECK (is_admin());
