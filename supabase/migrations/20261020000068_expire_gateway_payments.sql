-- A MonCash / NatCash payment that the gateway has not validated within 1 hour is cancelled automatically; the customer starts a new request.
--   * wallet top-up  : wallet_transactions pending -> cancelled (no money moved: it was never credited)
--   * checkout       : checkout_intents    pending -> failed    (no order was placed)
-- Safety net: if the customer did pay and the gateway confirms later, payment-verify still credits / orders it
-- (it accepts 'cancelled' top-ups and 'failed' intents), so a late genuine payment is never lost.

CREATE OR REPLACE FUNCTION public.expire_stale_gateway_payments()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0; k integer;
BEGIN
  WITH x AS (
    UPDATE wallet_transactions t SET status = 'cancelled'
     WHERE t.type = 'deposit' AND t.status = 'pending' AND t.payment_method IN ('moncash', 'natcash')
       AND t.created_at < now() - interval '1 hour'
    RETURNING t.wallet_id, t.amount, t.id
  )
  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link, data)
  SELECT w.user_id, 'warning',
         'Paiement expiré',
         'Votre paiement de ' || to_char(x.amount, 'FM999,999,990') || ' HTG n''a pas été validé en 1 heure : il a été annulé et aucun montant n''a été crédité. Lancez une nouvelle demande.',
         'Payment expired',
         'Your payment of ' || to_char(x.amount, 'FM999,999,990') || ' HTG was not validated within 1 hour: it was cancelled and nothing was credited. Please start a new request.',
         '/wallet', jsonb_build_object('transaction_id', x.id)
    FROM x JOIN wallets w ON w.id = x.wallet_id;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  WITH x AS (
    UPDATE checkout_intents i SET status = 'failed', updated_at = now()
     WHERE i.status = 'pending' AND i.method IN ('moncash', 'natcash')
       AND i.created_at < now() - interval '1 hour'
    RETURNING i.user_id, i.amount, i.id
  )
  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link, data)
  SELECT x.user_id, 'warning',
         'Paiement expiré',
         'Votre paiement de ' || to_char(x.amount, 'FM999,999,990') || ' HTG n''a pas été validé en 1 heure : il a été annulé et aucune commande n''a été passée. Relancez votre commande.',
         'Payment expired',
         'Your payment of ' || to_char(x.amount, 'FM999,999,990') || ' HTG was not validated within 1 hour: it was cancelled and no order was placed. Please place your order again.',
         '/cart', jsonb_build_object('intent_id', x.id)
    FROM x;
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_stale_gateway_payments() FROM PUBLIC, anon, authenticated;

-- every 10 minutes: a payment is cancelled between 60 and 70 minutes after it was started
SELECT cron.schedule('konvwa-expire-gateway-payments', '*/10 * * * *', 'SELECT public.expire_stale_gateway_payments()');
