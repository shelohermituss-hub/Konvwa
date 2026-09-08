-- RPC function to atomically increment wallet balance
-- Called by payment-verify Edge Function using service role
CREATE OR REPLACE FUNCTION increment_wallet_balance(p_wallet_id UUID, p_amount NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE wallets
  SET available_balance = available_balance + p_amount,
      updated_at = NOW()
  WHERE id = p_wallet_id;
END;
$$;
