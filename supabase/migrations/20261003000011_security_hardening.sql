-- Security hardening: rate limiting, login lockout, audit alerts, upload throttling, optional staff MFA enforcement

-- ── 1. Generic rate limiter (used by Edge Functions with the service role) ─────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer     NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- no policy: unreachable from the API

CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits  integer;
BEGIN
  INSERT INTO rate_limits (key, window_start, hits) VALUES (p_key, v_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  RETURN v_hits <= p_max;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- ── 2. Login lockout: 5 failures in 15 minutes lock the e-mail for 15 minutes ──
CREATE TABLE IF NOT EXISTS public.login_failures (
  email_hash text        PRIMARY KEY,
  failures   integer     NOT NULL DEFAULT 0,
  first_at   timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);
ALTER TABLE public.login_failures ENABLE ROW LEVEL SECURITY;  -- no policy

CREATE OR REPLACE FUNCTION public.login_lock_seconds(p_email text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT greatest(0, ceil(extract(epoch FROM locked_until - now()))::integer)
       FROM login_failures
      WHERE email_hash = encode(sha256(convert_to(lower(trim(p_email)), 'utf8')), 'hex')),
    0);
$$;

CREATE OR REPLACE FUNCTION public.record_login_failure(p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := encode(sha256(convert_to(lower(trim(p_email)), 'utf8')), 'hex');
  v_row  login_failures%ROWTYPE;
BEGIN
  IF p_email IS NULL OR length(p_email) > 320 THEN RETURN 0; END IF;

  INSERT INTO login_failures (email_hash, failures, first_at) VALUES (v_hash, 1, now())
  ON CONFLICT (email_hash) DO UPDATE SET
    failures = CASE WHEN login_failures.first_at < now() - interval '15 minutes' THEN 1 ELSE login_failures.failures + 1 END,
    first_at = CASE WHEN login_failures.first_at < now() - interval '15 minutes' THEN now() ELSE login_failures.first_at END
  RETURNING * INTO v_row;

  IF v_row.failures >= 5 THEN
    UPDATE login_failures SET locked_until = now() + interval '15 minutes', failures = 0, first_at = now()
     WHERE email_hash = v_hash;
    RETURN 900;
  END IF;
  RETURN 0;
END;
$$;

-- Only a signed-in user can reset the counter, and only their own (an attacker cannot erase failures)
CREATE OR REPLACE FUNCTION public.clear_login_failures()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE login_failures SET failures = 0, locked_until = NULL
   WHERE email_hash = encode(sha256(convert_to(lower(trim(coalesce(auth.jwt() ->> 'email', ''))), 'utf8')), 'hex');
$$;

REVOKE EXECUTE ON FUNCTION public.login_lock_seconds(text), public.record_login_failure(text), public.clear_login_failures() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_lock_seconds(text), public.record_login_failure(text) TO anon, authenticated;  -- needed before sign-in
GRANT EXECUTE ON FUNCTION public.clear_login_failures() TO authenticated;

-- ── 3. Alerts to admins for sensitive audit entries ────────────────────────────
INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('audit_alert_threshold_htg', '50000', 'Seuil d''alerte dépôt (HTG)',
        'Un dépôt approuvé d''un montant supérieur ou égal déclenche une alerte aux admins.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.alert_on_sensitive_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title    text;
  v_body     text;
  v_title_en text;
  v_body_en  text;
  v_actor    text := coalesce((SELECT full_name FROM profiles WHERE user_id = NEW.actor_id), 'Système');
  v_target   text;
  v_amount   numeric;
  v_limit    numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'audit_alert_threshold_htg'), 50000);
BEGIN
  IF NEW.resource_type = 'profiles' AND NEW.details ? 'role' THEN
    v_target   := coalesce((SELECT full_name FROM profiles WHERE user_id::text = NEW.details ->> 'owner_user_id'), 'un utilisateur');
    v_title    := 'Alerte sécurité : changement de rôle';
    v_body     := v_actor || ' a changé le rôle de ' || v_target || ' : ' ||
                  coalesce(NEW.details -> 'role' ->> 'from', '—') || ' → ' || coalesce(NEW.details -> 'role' ->> 'to', '—') || '.';
    v_title_en := 'Security alert: role changed';
    v_body_en  := v_actor || ' changed the role of ' || v_target || ': ' ||
                  coalesce(NEW.details -> 'role' ->> 'from', '—') || ' → ' || coalesce(NEW.details -> 'role' ->> 'to', '—') || '.';
  ELSIF NEW.resource_type = 'wallet_transactions' AND NEW.details -> 'status' ->> 'to' = 'completed' THEN
    SELECT amount INTO v_amount FROM wallet_transactions WHERE id::text = NEW.resource_id AND type = 'deposit';
    IF v_amount IS NULL OR v_amount < v_limit THEN RETURN NEW; END IF;
    v_title    := 'Alerte sécurité : gros dépôt approuvé';
    v_body     := v_actor || ' a approuvé un dépôt de ' || to_char(v_amount, 'FM999G999G990') || ' HTG.';
    v_title_en := 'Security alert: large deposit approved';
    v_body_en  := v_actor || ' approved a deposit of ' || to_char(v_amount, 'FM999G999G990') || ' HTG.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  SELECT p.user_id, 'warning', v_title, v_body, v_title_en, v_body_en, '/admin/audit-logs'
    FROM profiles p
   WHERE p.role = 'admin' AND p.user_id IS DISTINCT FROM NEW.actor_id;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alert_on_sensitive_audit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_alert_on_sensitive_audit
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.alert_on_sensitive_audit();

-- ── 5. Optional enforcement of MFA (aal2) for staff, off until every admin has enrolled ──
INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('staff_mfa_required', 'false', 'MFA obligatoire pour l''équipe',
        'Si "true", les comptes admin/manager doivent avoir validé leur code MFA (aal2) pour que la base les reconnaisse comme admin.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = (SELECT auth.uid())
    AND role IN ('admin', 'manager')
  ) AND (
    coalesce((SELECT value FROM app_settings WHERE key = 'staff_mfa_required'), 'false') <> 'true'
    OR coalesce((SELECT auth.jwt()) ->> 'aal', '') = 'aal2'
  );
END;
$$;
