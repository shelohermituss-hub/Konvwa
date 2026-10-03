-- Account setup ("quick setup"): new clients go through a guided flow once. The completion state is written only
-- by complete_onboarding(), which checks the mandatory parts (name, phone, notifications).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_skipped text[] NOT NULL DEFAULT '{}';

-- existing accounts are not sent through the setup
UPDATE public.profiles SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_profile_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.onboarding_completed_at := OLD.onboarding_completed_at;
      NEW.onboarding_skipped := OLD.onboarding_skipped;
    ELSE
      NEW.onboarding_completed_at := NULL;
      NEW.onboarding_skipped := '{}';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_onboarding() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_profile_onboarding
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_onboarding();

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_skipped text[] DEFAULT '{}', p_notifications_unsupported boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  v_profile profiles%ROWTYPE;
  v_skipped text[];
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Profil introuvable.'); END IF;
  IF v_profile.onboarding_completed_at IS NOT NULL THEN RETURN jsonb_build_object('success', true); END IF;

  IF length(trim(coalesce(v_profile.full_name, ''))) < 2 THEN
    RETURN jsonb_build_object('success', false, 'code', 'name', 'error', 'Renseignez votre nom complet.');
  END IF;
  IF length(regexp_replace(coalesce(v_profile.phone, ''), '\D', '', 'g')) < 8 THEN
    RETURN jsonb_build_object('success', false, 'code', 'phone', 'error', 'Renseignez un numéro de téléphone valide.');
  END IF;
  IF NOT p_notifications_unsupported AND NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'code', 'notifications', 'error', 'Autorisez les notifications pour continuer.');
  END IF;

  SELECT coalesce(array_agg(DISTINCT s), '{}') INTO v_skipped
    FROM unnest(coalesce(p_skipped, '{}')) s WHERE s IN ('address', 'passkey', 'mfa', 'kyc', 'camera', 'install');

  UPDATE profiles SET onboarding_completed_at = now(), onboarding_skipped = v_skipped WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text[], boolean) TO authenticated;
