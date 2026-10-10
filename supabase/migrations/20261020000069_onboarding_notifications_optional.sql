-- Notifications are no longer mandatory to finish the account setup (a refused permission used to lock new customers out).
-- Name and phone stay mandatory; a customer who skipped the notifications is reminded later ('notifications' joins the skipped items).
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

  SELECT coalesce(array_agg(DISTINCT s), '{}') INTO v_skipped
    FROM unnest(coalesce(p_skipped, '{}')) s WHERE s IN ('address', 'passkey', 'mfa', 'kyc', 'camera', 'install', 'notifications');

  UPDATE profiles SET onboarding_completed_at = now(), onboarding_skipped = v_skipped WHERE user_id = v_uid;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(text[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text[], boolean) TO authenticated;
