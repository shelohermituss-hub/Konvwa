-- Promo codes and referral rewards (credited to the wallet by the database only)

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code        text PRIMARY KEY CHECK (code = upper(code) AND length(code) BETWEEN 3 AND 32),
  credit_htg  numeric NOT NULL CHECK (credit_htg > 0 AND credit_htg <= 100000),
  max_uses    integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count  integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at  timestamptz,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_codes_admin_select ON public.promo_codes FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY promo_codes_admin_insert ON public.promo_codes FOR INSERT TO authenticated WITH CHECK (is_super_admin() AND used_count = 0);
CREATE POLICY promo_codes_admin_update ON public.promo_codes FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  code        text NOT NULL REFERENCES public.promo_codes(code),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_htg  numeric NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promo_redemptions_select ON public.promo_redemptions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR is_admin());

CREATE OR REPLACE FUNCTION public.redeem_promo_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := (SELECT auth.uid());
  v_code   text := upper(trim(coalesce(p_code, '')));
  c        promo_codes%ROWTYPE;
  v_wallet uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;

  SELECT * INTO c FROM promo_codes WHERE code = v_code FOR UPDATE;
  IF NOT FOUND OR NOT c.active OR (c.expires_at IS NOT NULL AND c.expires_at < now()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code promo invalide ou expiré.');
  END IF;
  IF c.used_count >= c.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce code promo a atteint sa limite d''utilisation.');
  END IF;
  IF EXISTS (SELECT 1 FROM promo_redemptions WHERE code = v_code AND user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous avez déjà utilisé ce code.');
  END IF;

  SELECT id INTO v_wallet FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;

  INSERT INTO promo_redemptions (code, user_id, credit_htg) VALUES (v_code, v_uid, c.credit_htg);
  UPDATE promo_codes SET used_count = used_count + 1 WHERE code = v_code;
  UPDATE wallets SET available_balance = available_balance + c.credit_htg, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description)
  VALUES (v_wallet, 'deposit', c.credit_htg, 'completed', 'wallet', 'Code promo ' || v_code);

  RETURN jsonb_build_object('success', true, 'credited', c.credit_htg);
END;
$$;

-- Referral ---------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referrals (
  referee_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz,
  CHECK (referee_id <> referrer_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY referrals_select ON public.referrals
  FOR SELECT TO authenticated USING (referee_id = (SELECT auth.uid()) OR referrer_id = (SELECT auth.uid()) OR is_admin());

INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('referral_reward_htg', '500', 'Bonus de parrainage (HTG)', 'Crédité au parrain ET au filleul au premier paiement éligible du filleul. 0 = désactivé.', false),
  ('referral_min_payment_htg', '2000', 'Paiement minimum pour le bonus (HTG)', 'Le filleul doit payer au moins ce montant pour déclencher le bonus.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.my_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := (SELECT auth.uid());
  v_code text;
  i      integer := 0;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT referral_code INTO v_code FROM profiles WHERE user_id = v_uid;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_uid::text), 1, 8));
    BEGIN
      UPDATE profiles SET referral_code = v_code WHERE user_id = v_uid AND referral_code IS NULL;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      i := i + 1;
      IF i > 5 THEN RAISE; END IF;
    END;
  END LOOP;
  RETURN (SELECT referral_code FROM profiles WHERE user_id = v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := (SELECT auth.uid());
  v_referrer uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  SELECT user_id INTO v_referrer FROM profiles WHERE referral_code = upper(trim(coalesce(p_code, '')));
  IF v_referrer IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Code de parrainage invalide.'); END IF;
  IF v_referrer = v_uid THEN RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas utiliser votre propre code.'); END IF;
  IF EXISTS (SELECT 1 FROM referrals WHERE referee_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un code de parrainage est déjà enregistré pour votre compte.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
     WHERE w.user_id = v_uid AND t.type = 'payment' AND t.status = 'completed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le code de parrainage doit être saisi avant votre premier paiement.');
  END IF;
  INSERT INTO referrals (referee_id, referrer_id) VALUES (v_uid, v_referrer);
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.reward_referral()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward  numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'referral_reward_htg'), 0);
  v_min     numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'referral_min_payment_htg'), 2000);
  v_referee uuid;
  r         referrals%ROWTYPE;
  v_user    uuid;
  v_wallet  uuid;
BEGIN
  IF v_reward <= 0 OR NEW.amount < v_min THEN RETURN NEW; END IF;
  SELECT user_id INTO v_referee FROM wallets WHERE id = NEW.wallet_id;
  SELECT * INTO r FROM referrals WHERE referee_id = v_referee AND rewarded_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE referrals SET rewarded_at = now() WHERE referee_id = r.referee_id;

  FOREACH v_user IN ARRAY ARRAY[r.referrer_id, r.referee_id] LOOP
    SELECT id INTO v_wallet FROM wallets WHERE user_id = v_user FOR UPDATE;
    IF v_wallet IS NULL THEN CONTINUE; END IF;
    UPDATE wallets SET available_balance = available_balance + v_reward, updated_at = now() WHERE id = v_wallet;
    INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description)
    VALUES (v_wallet, 'deposit', v_reward, 'completed', 'wallet', 'Bonus de parrainage');
    INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
    VALUES (v_user, 'success', 'Bonus de parrainage reçu',
            to_char(v_reward, 'FM999G999G990') || ' HTG ont été ajoutés à votre portefeuille grâce au parrainage.',
            'Referral bonus received',
            to_char(v_reward, 'FM999G999G990') || ' HTG were added to your wallet thanks to the referral.',
            '/wallet');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reward_referral
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW WHEN (NEW.type = 'payment' AND NEW.status = 'completed')
  EXECUTE FUNCTION public.reward_referral();

REVOKE EXECUTE ON FUNCTION public.reward_referral() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_promo_code(text), public.my_referral_code(), public.apply_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text), public.my_referral_code(), public.apply_referral(text) TO authenticated;
