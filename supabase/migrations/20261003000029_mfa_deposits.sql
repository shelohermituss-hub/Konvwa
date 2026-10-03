-- MFA scope for clients: no code at sign-in. The code (when the client enabled MFA) is asked for payments AND
-- top-ups (recharges), from the threshold amount. Staff keep the code at sign-in.

-- Lets the Edge Functions (called with the user's JWT) ask the same question as the SQL payment functions.
CREATE OR REPLACE FUNCTION public.check_mfa(p_amount numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.mfa_ok(p_amount) $$;
REVOKE EXECUTE ON FUNCTION public.check_mfa(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_mfa(numeric) TO authenticated;

-- Manual top-ups (bank transfer, crypto) are inserted by the client: refuse them without a fresh code.
-- Top-ups through MonCash/NatCash are inserted by an Edge Function (service role) which calls check_mfa() itself.
CREATE OR REPLACE FUNCTION public.guard_deposit_mfa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'deposit'
     AND coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
     AND NOT public.mfa_ok(NEW.amount) THEN
    RAISE EXCEPTION 'mfa_required' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_deposit_mfa() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_deposit_mfa
  BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_deposit_mfa();
