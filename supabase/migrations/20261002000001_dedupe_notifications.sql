-- ============================================================
-- KONVWA — Reduce notification spam
--  * notify_once(): skips an identical notification sent in the last hour
--  * order status: only milestones the client cares about
--  * wallet: no "Paiement débité" (already covered by order / shipping notices)
--  * deposit rejection handled by trigger (front-end inserts removed)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_once(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text,
  p_link    text,
  p_data    jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = p_user_id
      AND n.title = p_title
      AND n.link IS NOT DISTINCT FROM p_link
      AND COALESCE(n.data->>'transaction_id', '') = COALESCE(p_data->>'transaction_id', '')
      AND n.created_at > now() - interval '1 hour'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, p_data);
END;
$$;

-- ──────────────────────────────────────────────────
-- Orders: status change (milestones only)
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text;
  v_body  text;
  v_type  text;
  v_link  text := '/orders/' || NEW.id;
  v_admin_title text;
  v_admin_body  text;
  v_data  jsonb := jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code);
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'submitted' THEN
      v_title := 'Commande soumise';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été reçue. Notre équipe prépare votre devis.';
      v_type  := 'info';
      v_admin_title := 'Nouvelle commande — ' || NEW.tracking_code;
      v_admin_body  := 'Une nouvelle commande vient d''être soumise. Préparez le devis.';

    WHEN 'quote_sent', 'quoted' THEN
      v_title := 'Devis disponible — ' || NEW.tracking_code;
      v_body  := 'Le devis de votre commande ' || NEW.tracking_code || ' est prêt. Consultez-le et procédez au paiement.';
      v_type  := 'success';

    WHEN 'paid' THEN
      v_title := 'Paiement confirmé — ' || NEW.tracking_code;
      v_body  := 'Votre paiement pour la commande ' || NEW.tracking_code || ' a été confirmé. L''achat va commencer.';
      v_type  := 'success';
      v_admin_title := 'Paiement reçu — ' || NEW.tracking_code;
      v_admin_body  := 'Le paiement de la commande ' || NEW.tracking_code || ' est confirmé. Vous pouvez lancer l''achat.';

    WHEN 'in_china_warehouse' THEN
      IF NEW.shipping_option = 'separate' THEN
        v_title := 'Disponible en entrepôt — Choisissez votre expédition';
        v_body  := 'Votre commande ' || NEW.tracking_code || ' est prête en entrepôt Chine. Allez sur Expéditions pour choisir votre mode d''envoi.';
        v_type  := 'success';
        v_link  := '/expeditions';
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'shipped' THEN
      v_title := 'Expédiée depuis la Chine — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en route vers Haïti.';
      v_type  := 'success';

    WHEN 'arrived' THEN
      v_title := 'Arrivée en Haïti — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est arrivée en Haïti. Le dédouanement va commencer.';
      v_type  := 'success';

    WHEN 'delivered' THEN
      v_title := 'Livrée — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été livrée. Merci de votre confiance chez Konvwa !';
      v_type  := 'success';

    WHEN 'cancelled' THEN
      v_title := 'Commande annulée — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été annulée. Contactez-nous si vous avez des questions.';
      v_type  := 'error';
      v_admin_title := 'Commande annulée — ' || NEW.tracking_code;
      v_admin_body  := 'La commande ' || NEW.tracking_code || ' a été annulée.';

    ELSE
      -- reviewing, awaiting_payment, purchasing, in_transit, customs*, delivery*:
      -- visible in order tracking, no push/in-app notification.
      RETURN NEW;
  END CASE;

  PERFORM notify_once(NEW.user_id, v_type, v_title, v_body, v_link, v_data);

  IF v_admin_title IS NOT NULL THEN
    PERFORM notify_once(uid, v_type, v_admin_title, v_admin_body, '/admin/orders/' || NEW.id, v_data)
    FROM get_admin_user_ids() AS uid;
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────
-- Orders: INSERT (submitted or quote_sent) — same titles as the UPDATE trigger
-- so notify_once() collapses any double firing.
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_data jsonb := jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code);
BEGIN
  IF NEW.status = 'submitted' THEN
    PERFORM notify_once(
      NEW.user_id, 'info', 'Commande soumise',
      'Votre commande ' || NEW.tracking_code || ' a été reçue. Notre équipe prépare votre devis.',
      '/orders/' || NEW.id, v_data
    );
    PERFORM notify_once(
      uid, 'info', 'Nouvelle commande — ' || NEW.tracking_code,
      'Une nouvelle commande vient d''être soumise. Préparez le devis.',
      '/admin/orders/' || NEW.id, v_data
    ) FROM get_admin_user_ids() AS uid;

  ELSIF NEW.status IN ('quote_sent', 'quoted') THEN
    PERFORM notify_once(
      NEW.user_id, 'success', 'Devis disponible — ' || NEW.tracking_code,
      'Le devis de votre commande ' || NEW.tracking_code || ' est prêt. Consultez-le et procédez au paiement.',
      '/orders/' || NEW.id, v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────
-- Wallet: drop "Paiement débité" (order / shipping flows already notify)
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_wallet_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid;
  v_amount_fmt text;
  v_data       jsonb;
BEGIN
  SELECT w.user_id INTO v_user_id FROM wallets w WHERE w.id = NEW.wallet_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_amount_fmt := to_char(NEW.amount, 'FM999,999,990') || ' HTG';
  v_data := jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount);

  IF NEW.type = 'deposit' THEN
    IF NEW.status = 'pending' THEN
      PERFORM notify_once(
        v_user_id, 'info', 'Dépôt en attente de confirmation',
        'Votre dépôt de ' || v_amount_fmt || ' est en cours de vérification. Délai habituel : 24–48h.',
        '/wallet', v_data
      );
      PERFORM notify_once(
        uid, 'warning', 'Preuve de dépôt à vérifier',
        'Un dépôt de ' || v_amount_fmt || ' via ' || COALESCE(NEW.payment_method, '?') || ' attend votre validation.',
        '/admin/payments', v_data
      ) FROM get_admin_user_ids() AS uid;

    ELSIF NEW.status = 'completed' THEN
      PERFORM notify_once(
        v_user_id, 'success', 'Dépôt confirmé',
        'Votre dépôt de ' || v_amount_fmt || ' a été crédité sur votre portefeuille.',
        '/wallet', v_data
      );
    END IF;

  ELSIF NEW.type = 'refund' AND NEW.status = 'completed' THEN
    PERFORM notify_once(
      v_user_id, 'success', 'Remboursement reçu',
      'Un remboursement de ' || v_amount_fmt || ' a été crédité sur votre portefeuille.',
      '/wallet', v_data
    );

  ELSIF NEW.type = 'adjustment' THEN
    PERFORM notify_once(
      v_user_id, 'info', 'Ajustement de portefeuille',
      COALESCE(NEW.description, 'Un ajustement de ' || v_amount_fmt || ' a été appliqué à votre portefeuille.'),
      '/wallet', v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────
-- Wallet: deposit validated or rejected by admin
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_deposit_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid;
  v_amount_fmt text;
  v_data       jsonb;
BEGIN
  IF NOT (OLD.type = 'deposit' AND OLD.status = 'pending' AND NEW.status IN ('completed', 'cancelled')) THEN
    RETURN NEW;
  END IF;

  SELECT w.user_id INTO v_user_id FROM wallets w WHERE w.id = NEW.wallet_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_amount_fmt := to_char(NEW.amount, 'FM999,999,990') || ' HTG';
  v_data := jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount);

  IF NEW.status = 'completed' THEN
    PERFORM notify_once(
      v_user_id, 'success', 'Dépôt confirmé',
      'Votre dépôt de ' || v_amount_fmt || ' a été validé. Le solde est disponible dans votre portefeuille.',
      '/wallet', v_data
    );
  ELSE
    PERFORM notify_once(
      v_user_id, 'warning', 'Dépôt refusé',
      'Votre demande de dépôt de ' || v_amount_fmt || ' a été refusée. Contactez le support si besoin.',
      '/wallet', v_data
    );
  END IF;

  RETURN NEW;
END;
$$;
