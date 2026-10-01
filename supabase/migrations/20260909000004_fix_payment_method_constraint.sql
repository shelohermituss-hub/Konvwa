-- Expand payment_method CHECK to include manual deposit methods (virement, btc, usdt, eth)
ALTER TABLE wallet_transactions
  DROP CONSTRAINT wallet_transactions_payment_method_check;

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_transactions_payment_method_check
  CHECK (payment_method = ANY (ARRAY[
    'moncash', 'natcash', 'wallet',
    'virement', 'btc', 'usdt', 'eth'
  ]));
