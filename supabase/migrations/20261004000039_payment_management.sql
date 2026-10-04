-- Payment management for the team: full history with filters / search / pagination, statistics, manual wallet adjustment.

-- deposits are reviewed with the same staff check as everything else (MFA required for staff)
DO $$
DECLARE def text; new_def text;
BEGIN
  def := pg_get_functiondef('public.admin_review_deposit(uuid,boolean)'::regprocedure);
  new_def := replace(def, E'IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN (''admin'', ''manager'')) THEN', 'IF NOT is_admin() THEN');
  IF new_def = def THEN RAISE EXCEPTION 'admin_review_deposit: pattern not found'; END IF;
  EXECUTE new_def;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_transactions(
  p_status text DEFAULT 'all', p_type text DEFAULT 'all', p_method text DEFAULT 'all',
  p_from date DEFAULT NULL, p_to date DEFAULT NULL, p_search text DEFAULT NULL,
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
RETURNS TABLE (id uuid, type text, amount numeric, status text, payment_method text, description text, reference text, proof_url text,
               plop_transaction_id text, created_at timestamptz, wallet_id uuid, refund_of uuid, user_id uuid,
               customer_name text, customer_phone text, customer_email text, refunded boolean, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
     AND (p_type = 'all' OR t.type = p_type)
     AND (p_method = 'all' OR t.payment_method = p_method)
     AND (p_from IS NULL OR t.created_at >= p_from)
     AND (p_to IS NULL OR t.created_at < p_to + 1)
     AND (s IS NULL OR p.full_name ILIKE s OR p.phone ILIKE s OR u.email ILIKE s OR t.reference ILIKE s
          OR t.description ILIKE s OR t.plop_transaction_id ILIKE s OR t.id::text ILIKE s)
   ORDER BY t.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 20), 1), 5000) OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_transactions(text, text, text, date, date, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_transactions(text, text, text, date, date, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_payment_stats(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT is_admin() THEN RETURN '{}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'pending_count', (SELECT count(*) FROM wallet_transactions WHERE status = 'pending'),
    'pending_amount', (SELECT coalesce(sum(amount), 0) FROM wallet_transactions WHERE status = 'pending' AND type = 'deposit'),
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
REVOKE EXECUTE ON FUNCTION public.admin_payment_stats(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payment_stats(date, date) TO authenticated;

-- manual correction of a customer's wallet (full administrators only; reason required; logged in the audit trail)
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_user uuid, p_amount numeric, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet uuid; v_balance numeric; v_reason text := nullif(trim(coalesce(p_reason, '')), ''); v_abs numeric := abs(coalesce(p_amount, 0));
BEGIN
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé aux administrateurs.'); END IF;
  IF p_amount IS NULL OR v_abs < 1 OR v_abs > 1000000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant invalide.');
  END IF;
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif de l''ajustement.');
  END IF;
  IF p_user = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas ajuster votre propre portefeuille.');
  END IF;
  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = p_user FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF p_amount < 0 AND v_balance < v_abs THEN
    RETURN jsonb_build_object('success', false, 'error', 'Solde insuffisant pour ce débit.');
  END IF;

  UPDATE wallets SET available_balance = available_balance + p_amount, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description, reference)
  VALUES (v_wallet, CASE WHEN p_amount > 0 THEN 'deposit' ELSE 'withdrawal' END, v_abs, 'completed',
          'Ajustement ' || CASE WHEN p_amount > 0 THEN 'crédit' ELSE 'débit' END || ' — ' || left(v_reason, 150),
          'ADJ-' || upper(substr(gen_random_uuid()::text, 1, 8)));
  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, details)
  VALUES (auth.uid(), 'admin', 'wallet_adjustment', 'wallet', v_wallet::text,
          jsonb_build_object('user_id', p_user, 'amount', p_amount, 'reason', v_reason, 'balance_before', v_balance, 'balance_after', v_balance + p_amount));
  RETURN jsonb_build_object('success', true, 'balance', v_balance + p_amount);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(uuid, numeric, text) TO authenticated;
