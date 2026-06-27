-- ════════════════════════════════════════════════════════════════
-- 1. handle_new_user trigger — auto-create profile + wallet
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    'client'
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, available_balance, blocked_balance)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════════
-- 2. Backfill existing users missing profile or wallet
-- ════════════════════════════════════════════════════════════════
INSERT INTO public.profiles (user_id, full_name, phone, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  au.raw_user_meta_data->>'phone',
  'client'
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.wallets (user_id, available_balance, blocked_balance)
SELECT au.id, 0, 0
FROM auth.users au
LEFT JOIN public.wallets w ON w.user_id = au.id
WHERE w.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- 3. Fix pay_order RPC — 'processing' → 'paid'
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.pay_order(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id       uuid;
  v_order_status  text;
  v_tracking_code text;
  v_quote_total   numeric;
  v_wallet_id     uuid;
  v_balance       numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT status, tracking_code
  INTO v_order_status, v_tracking_code
  FROM orders
  WHERE id = p_order_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order_status NOT IN ('awaiting_payment', 'quote_accepted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is not awaiting payment');
  END IF;

  SELECT q.total INTO v_quote_total
  FROM quotes q
  INNER JOIN orders o ON o.quote_id = q.id
  WHERE o.id = p_order_id
  LIMIT 1;

  IF v_quote_total IS NULL OR v_quote_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid quote found');
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_balance
  FROM wallets
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF v_balance < v_quote_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
      'balance', v_balance, 'required', v_quote_total);
  END IF;

  UPDATE wallets
  SET available_balance = available_balance - v_quote_total,
      updated_at = now()
  WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet_id, 'payment', v_quote_total, 'completed',
          'Paiement commande ' || v_tracking_code);

  UPDATE orders
  SET payment_status = 'paid',
      total_paid     = v_quote_total,
      status         = 'paid',
      updated_at     = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'amount', v_quote_total);
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- 4. accept_quote RPC — SECURITY DEFINER so client can update
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.accept_quote(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  uuid;
  v_quote_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT quote_id INTO v_quote_id
  FROM orders
  WHERE id = p_order_id
    AND user_id = v_user_id
    AND status = 'quote_sent';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not in quote_sent status');
  END IF;

  UPDATE quotes SET status = 'accepted', updated_at = now() WHERE id = v_quote_id;
  UPDATE orders SET status = 'awaiting_payment', updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ════════════════════════════════════════════════════════════════
-- 5. reject_quote RPC — SECURITY DEFINER so client can update
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reject_quote(p_order_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  uuid;
  v_quote_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT quote_id INTO v_quote_id
  FROM orders
  WHERE id = p_order_id
    AND user_id = v_user_id
    AND status = 'quote_sent';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found or not in quote_sent status');
  END IF;

  UPDATE quotes SET status = 'rejected', updated_at = now() WHERE id = v_quote_id;
  UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
