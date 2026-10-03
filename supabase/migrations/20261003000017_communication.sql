-- Communication: support chat notifications + realtime, WhatsApp contact setting, guard on critical settings

INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('support_whatsapp', '', 'Numéro WhatsApp du support',
        'Format international sans + ni espaces (ex : 50937000000). Vide = bouton masqué.', false)
ON CONFLICT (key) DO NOTHING;

-- Only a full admin may change the settings that control money or security rules
CREATE OR REPLACE FUNCTION public.guard_critical_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;  -- migrations / service role
  IF (TG_OP = 'INSERT' OR NEW.value IS DISTINCT FROM OLD.value)
     AND NEW.key IN ('staff_mfa_required', 'mfa_payment_threshold_htg', 'kyc_required_above_htg',
                     'audit_alert_threshold_htg', 'referral_reward_htg', 'referral_min_payment_htg',
                     'payment_client_id', 'payment_client_secret', 'payment_base_url', 'payment_return_url')
     AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_critical_settings() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_critical_settings
  BEFORE INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_critical_settings();

-- A new support message notifies the other side and refreshes the ticket
CREATE OR REPLACE FUNCTION public.notify_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t support_tickets%ROWTYPE;
  v_name text;
BEGIN
  SELECT * INTO t FROM support_tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE support_tickets SET updated_at = now() WHERE id = t.id;

  IF NEW.sender_id = t.user_id THEN
    SELECT coalesce(full_name, 'Un client') INTO v_name FROM profiles WHERE user_id = t.user_id;
    INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
    SELECT p.user_id, 'info', 'Nouveau message support',
           v_name || ' : ' || left(NEW.message, 120),
           'New support message',
           v_name || ': ' || left(NEW.message, 120),
           '/admin/disputes'
      FROM profiles p WHERE p.role IN ('admin', 'manager');
  ELSE
    INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
    VALUES (t.user_id, 'info', 'Nouvelle réponse du support',
            left(NEW.message, 140),
            'New reply from support',
            left(NEW.message, 140),
            '/support/' || t.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_support_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_support_message
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- A message must be sent under the sender's own identity (it used to accept any sender_id)
ALTER POLICY users_insert_own_messages ON public.support_messages
  WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM support_tickets
       WHERE support_tickets.id = support_messages.ticket_id
         AND (support_tickets.user_id = (SELECT auth.uid()) OR is_admin())
    )
  );
