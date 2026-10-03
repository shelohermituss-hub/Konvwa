-- Admin insights: one read-only RPC feeding the "Pilotage" screen
CREATE OR REPLACE FUNCTION public.admin_insights()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev_30   numeric;
  v_rev_prev numeric;
  v_conv     jsonb;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''équipe.'; END IF;

  SELECT coalesce(sum(CASE t.type WHEN 'payment' THEN t.amount WHEN 'refund' THEN -t.amount ELSE 0 END), 0)
    INTO v_rev_30
    FROM wallet_transactions t
   WHERE t.status = 'completed' AND t.type IN ('payment', 'refund') AND t.created_at >= now() - interval '30 days';

  SELECT coalesce(sum(CASE t.type WHEN 'payment' THEN t.amount WHEN 'refund' THEN -t.amount ELSE 0 END), 0)
    INTO v_rev_prev
    FROM wallet_transactions t
   WHERE t.status = 'completed' AND t.type IN ('payment', 'refund')
     AND t.created_at >= now() - interval '60 days' AND t.created_at < now() - interval '30 days';

  SELECT jsonb_build_object(
           'quoted', count(*) FILTER (WHERE o.quote_id IS NOT NULL),
           'paid',   count(*) FILTER (WHERE o.quote_id IS NOT NULL AND o.payment_status = 'paid'))
    INTO v_conv
    FROM orders o WHERE o.created_at >= now() - interval '90 days';

  RETURN jsonb_build_object(
    'revenue_30d', v_rev_30,
    'revenue_prev_30d', v_rev_prev,
    'orders_30d', (SELECT count(*) FROM orders WHERE created_at >= now() - interval '30 days')
                + (SELECT count(*) FROM product_orders WHERE created_at >= now() - interval '30 days'),
    'margin_30d', coalesce((
        SELECT sum(q.margin) FROM orders o JOIN quotes q ON q.id = o.quote_id
         WHERE o.payment_status = 'paid' AND o.created_at >= now() - interval '30 days'), 0),
    'quote_conversion', v_conv,
    'pending_deposits', jsonb_build_object(
        'count', (SELECT count(*) FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending'),
        'amount', coalesce((SELECT sum(amount) FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending'), 0)),
    'kyc_pending', (SELECT count(*) FROM kyc_submissions WHERE status = 'pending'),
    'open_tickets', (SELECT count(*) FROM support_tickets WHERE status IN ('open', 'in_progress')),
    'wallet_total', coalesce((SELECT sum(available_balance) FROM wallets), 0),
    'stuck_orders', coalesce((
        SELECT jsonb_agg(jsonb_build_object('id', s.id, 'tracking_code', s.tracking_code, 'status', s.status,
                                            'updated_at', s.updated_at) ORDER BY s.updated_at)
          FROM (SELECT id, tracking_code, status, updated_at FROM orders
                 WHERE status NOT IN ('draft', 'delivered', 'closed', 'cancelled')
                   AND updated_at < now() - interval '7 days'
                 ORDER BY updated_at LIMIT 20) s), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_insights() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_insights() TO authenticated;
