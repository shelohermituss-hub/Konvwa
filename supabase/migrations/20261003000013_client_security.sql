-- Client security: step-up MFA for large payments, device list and new-login alerts

-- ── 1. Step-up: a payment of at least the threshold needs a TOTP code verified in the last 10 minutes,
--       for clients who enabled MFA. (Clients without MFA are not blocked.)
INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('mfa_payment_threshold_htg', '20000', 'Seuil de confirmation par code (HTG)',
        'Un paiement de ce montant ou plus exige un code MFA récent pour les clients qui ont activé la MFA.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.mfa_ok(p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_threshold numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'mfa_payment_threshold_htg'), 20000);
BEGIN
  IF p_amount < v_threshold OR v_uid IS NULL THEN RETURN true; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.mfa_factors WHERE user_id = v_uid AND status = 'verified') THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1
      FROM jsonb_array_elements(coalesce((SELECT auth.jwt()) -> 'amr', '[]'::jsonb)) a
     WHERE a ->> 'method' = 'totp'
       AND (a ->> 'timestamp')::bigint > extract(epoch FROM now()) - 600
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mfa_ok(numeric) FROM PUBLIC, anon, authenticated;

-- Patch the four payment functions: refuse before any money moves
DO $$
DECLARE
  f record;
  d text;
  n text;
  chk text;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('public.pay_order(uuid)',                'v_quote_total'),
    ('public.pay_product_order(uuid)',        'v_total'),
    ('public.pay_shipping_quote(uuid, text)', 'v_charge'),
    ('public.pay_shipping_balance(uuid)',     'v_rest')
  ) AS t(sig, amount_var) LOOP
    d := pg_get_functiondef(f.sig::regprocedure);
    chk := '  IF NOT public.mfa_ok(' || f.amount_var || E') THEN\n'
        || E'    RETURN jsonb_build_object(''success'', false, ''code'', ''mfa_required'',\n'
        || E'      ''error'', ''Confirmation par code requise pour ce paiement.'');\n'
        || E'  END IF;\n\n';
    n := replace(d, '  UPDATE wallets', chk || '  UPDATE wallets');
    IF n = d THEN RAISE EXCEPTION 'anchor not found in %', f.sig; END IF;
    EXECUTE n;
  END LOOP;
END;
$$;

-- ── 2. Devices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id  text        NOT NULL CHECK (length(device_id) BETWEEN 8 AND 64),
  label      text        NOT NULL CHECK (length(label) <= 80),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id, device_id)
);
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_devices_select_own ON public.user_devices
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
-- no INSERT/UPDATE/DELETE policy: writes go through the functions below

CREATE OR REPLACE FUNCTION public.register_device(p_device_id text, p_label text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  v_row     user_devices%ROWTYPE;
  v_others  integer;
  v_label   text := left(coalesce(nullif(trim(p_label), ''), 'Appareil inconnu'), 80);
BEGIN
  IF v_uid IS NULL OR p_device_id IS NULL OR length(p_device_id) NOT BETWEEN 8 AND 64 THEN RETURN false; END IF;

  SELECT * INTO v_row FROM user_devices WHERE user_id = v_uid AND device_id = p_device_id;

  IF FOUND AND v_row.revoked_at IS NULL THEN
    UPDATE user_devices SET last_seen = now(), label = v_label WHERE user_id = v_uid AND device_id = p_device_id;
    RETURN false;
  END IF;

  SELECT count(*) INTO v_others FROM user_devices WHERE user_id = v_uid AND revoked_at IS NULL;
  IF v_others >= 20 THEN RETURN false; END IF;

  INSERT INTO user_devices (user_id, device_id, label) VALUES (v_uid, p_device_id, v_label)
  ON CONFLICT (user_id, device_id) DO UPDATE SET revoked_at = NULL, label = v_label, last_seen = now(), first_seen = now();

  IF v_others > 0 THEN
    INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
    VALUES (
      v_uid, 'warning',
      'Nouvelle connexion détectée',
      'Connexion depuis un nouvel appareil : ' || v_label || '. Si ce n''est pas vous, changez votre mot de passe et déconnectez les autres appareils.',
      'New sign-in detected',
      'Sign-in from a new device: ' || v_label || '. If this was not you, change your password and sign out your other devices.',
      '/profile'
    );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_devices(p_device_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE user_devices SET revoked_at = now()
   WHERE user_id = (SELECT auth.uid()) AND device_id <> p_device_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_device(text, text), public.revoke_other_devices(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_device(text, text), public.revoke_other_devices(text) TO authenticated;
