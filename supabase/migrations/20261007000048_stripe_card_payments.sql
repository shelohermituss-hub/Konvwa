-- Card payments through Stripe Checkout (hosted page). Like MonCash / NatCash, a Stripe payment is validated by the provider before
-- anything reaches the team or the customer's wallet: the Edge Function `stripe-checkout` asks Stripe for the session status.
-- The Stripe session id is kept in plop_transaction_id (a plain provider-transaction column).

ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_payment_method_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY['moncash', 'natcash', 'wallet', 'virement', 'btc', 'usdt', 'eth', 'stripe']));

ALTER TABLE public.checkout_intents DROP CONSTRAINT checkout_intents_method_check;
ALTER TABLE public.checkout_intents ADD CONSTRAINT checkout_intents_method_check
  CHECK (method = ANY (ARRAY['moncash', 'natcash', 'stripe']));

-- The team queue / stats treat gateway payments (never reviewed by hand) as ('moncash','natcash'): Stripe joins that list.
-- fulfill_checkout_intent also gets the right label for the wallet history. Grants are kept (CREATE OR REPLACE).
DO $$
DECLARE f regprocedure; d text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_review_deposit(uuid,boolean)'::regprocedure,
    'public.admin_list_transactions(text,text,text,date,date,text,integer,integer)'::regprocedure,
    'public.admin_payment_stats(date,date)'::regprocedure,
    'public.fulfill_checkout_intent(text)'::regprocedure
  ] LOOP
    d := pg_get_functiondef(f);
    d := replace(d, '(''moncash'', ''natcash'')', '(''moncash'', ''natcash'', ''stripe'')');
    d := replace(d, 'WHEN ''moncash'' THEN ''MonCash'' ELSE ''NatCash''', 'WHEN ''moncash'' THEN ''MonCash'' WHEN ''stripe'' THEN ''carte (Stripe)'' ELSE ''NatCash''');
    EXECUTE d;
  END LOOP;
END $$;

-- Stripe keys live in app_settings as sensitive rows (readable by admins and the service role only); the values are set by hand, never in a migration.
