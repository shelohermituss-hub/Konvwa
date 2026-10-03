-- ============================================================
-- KONVWA — Automatic notification system
-- Triggers on: orders (INSERT + UPDATE), wallet_transactions (INSERT + UPDATE)
-- Every state change generates an in-app notification + Web Push (via existing trigger).
-- ============================================================

-- ──────────────────────────────────────────────────
-- Helper: return all admin / manager user IDs
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_admin_user_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT user_id FROM profiles WHERE role IN ('admin', 'manager');
$$;

-- ──────────────────────────────────────────────────
-- 1. Order status change → client + admin notifications
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_title text;
  v_body  text;
  v_type  text;
  v_link  text;
  v_admin_title text;
  v_admin_body  text;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  v_link := '/orders/' || NEW.id;

  CASE NEW.status
    WHEN 'submitted' THEN
      v_title := 'Commande soumise';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été reçue. Notre équipe vous enverra un devis sous peu.';
      v_type  := 'info';
      v_admin_title := 'Nouvelle commande — ' || NEW.tracking_code;
      v_admin_body  := 'Une commande vient d''être soumise. Préparez le devis.';

    WHEN 'reviewing' THEN
      v_title := 'Commande en cours d''examen';
      v_body  := 'Notre équipe examine votre commande ' || NEW.tracking_code || '. Vous serez notifié dès le devis prêt.';
      v_type  := 'info';

    WHEN 'quote_sent' THEN
      v_title := 'Devis en préparation';
      v_body  := 'Le devis pour votre commande ' || NEW.tracking_code || ' est en cours de finalisation.';
      v_type  := 'info';

    WHEN 'quoted' THEN
      v_title := 'Devis disponible — Action requise';
      v_body  := 'Le devis de votre commande ' || NEW.tracking_code || ' est prêt. Consultez-le et procédez au paiement.';
      v_type  := 'success';

    WHEN 'awaiting_payment' THEN
      v_title := 'En attente de paiement';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en attente de votre paiement pour continuer.';
      v_type  := 'warning';

    WHEN 'paid' THEN
      v_title := 'Paiement confirmé';
      v_body  := 'Votre paiement pour la commande ' || NEW.tracking_code || ' a été confirmé. L''achat est en cours.';
      v_type  := 'success';
      v_admin_title := 'Paiement reçu — ' || NEW.tracking_code;
      v_admin_body  := 'Le paiement de la commande ' || NEW.tracking_code || ' est confirmé. Vous pouvez lancer l''achat.';

    WHEN 'purchasing' THEN
      v_title := 'Achat en cours';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en cours d''achat chez le fournisseur.';
      v_type  := 'info';

    WHEN 'in_china_warehouse' THEN
      IF NEW.shipping_option = 'separate' THEN
        v_title := 'Disponible en entrepôt — Choisissez votre expédition';
        v_body  := 'Votre commande ' || NEW.tracking_code || ' est prête en entrepôt Chine. Allez sur Expéditions pour choisir votre mode d''envoi.';
        v_type  := 'success';
        v_link  := '/expeditions';
      ELSE
        v_title := 'Arrivée en entrepôt Chine';
        v_body  := 'Votre commande ' || NEW.tracking_code || ' est en entrepôt Chine. L''expédition vers Haïti est en cours de préparation.';
        v_type  := 'success';
      END IF;

    WHEN 'shipped' THEN
      v_title := 'Expédiée depuis la Chine';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été expédiée depuis la Chine. Elle est en route !';
      v_type  := 'success';

    WHEN 'in_transit' THEN
      v_title := 'En transit';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en cours d''acheminement vers Haïti.';
      v_type  := 'info';

    WHEN 'arrived' THEN
      v_title := 'Arrivée en Haïti !';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est arrivée en Haïti. Le dédouanement va commencer.';
      v_type  := 'success';

    WHEN 'customs' THEN
      v_title := 'Passage en douane';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est actuellement en cours de dédouanement.';
      v_type  := 'info';

    WHEN 'customs_clearance' THEN
      v_title := 'Dédouanement en cours';
      v_body  := 'Le dédouanement de votre commande ' || NEW.tracking_code || ' est en cours de finalisation.';
      v_type  := 'info';

    WHEN 'delivery' THEN
      v_title := 'En cours de livraison';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en cours de livraison. Soyez disponible à votre adresse.';
      v_type  := 'info';

    WHEN 'delivering' THEN
      v_title := 'Livraison imminente';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en chemin vers vous. Préparez-vous à la réceptionner !';
      v_type  := 'info';

    WHEN 'delivered' THEN
      v_title := 'Livrée avec succès !';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été livrée. Merci de votre confiance chez Konvwa !';
      v_type  := 'success';

    WHEN 'cancelled' THEN
      v_title := 'Commande annulée';
      v_body  := 'Votre commande ' || NEW.tracking_code || ' a été annulée. Contactez-nous si vous avez des questions.';
      v_type  := 'error';
      v_admin_title := 'Commande annulée — ' || NEW.tracking_code;
      v_admin_body  := 'La commande ' || NEW.tracking_code || ' a été annulée.';

    ELSE
      RETURN NEW;
  END CASE;

  -- Notify client
  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (
    NEW.user_id, v_type, v_title, v_body, v_link,
    jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code, 'status', NEW.status)
  );

  -- Notify admins on key statuses
  IF v_admin_title IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link, data)
    SELECT
      uid, v_type, v_admin_title, v_admin_body,
      '/admin/orders/' || NEW.id,
      jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code)
    FROM get_admin_user_ids() AS uid;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_notify_order_status ON orders;
CREATE TRIGGER trg_auto_notify_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_order_status();

-- ──────────────────────────────────────────────────
-- 2. New order submitted (INSERT) → confirmation
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_new_order()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status != 'submitted' THEN RETURN NEW; END IF;

  -- Client
  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (
    NEW.user_id, 'info',
    'Commande soumise avec succès',
    'Votre commande ' || NEW.tracking_code || ' a été reçue. Notre équipe prépare votre devis.',
    '/orders/' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code)
  );

  -- Admins
  INSERT INTO notifications (user_id, type, title, body, link, data)
  SELECT
    uid, 'info',
    'Nouvelle commande — ' || NEW.tracking_code,
    'Une nouvelle commande vient d''être soumise. Préparez le devis.',
    '/admin/orders/' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'tracking_code', NEW.tracking_code)
  FROM get_admin_user_ids() AS uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_notify_new_order ON orders;
CREATE TRIGGER trg_auto_notify_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_new_order();

-- ──────────────────────────────────────────────────
-- 3. Wallet transactions → client + admin notifications
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_wallet_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid;
  v_amount_fmt text;
BEGIN
  SELECT w.user_id INTO v_user_id FROM wallets w WHERE w.id = NEW.wallet_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_amount_fmt := to_char(NEW.amount, 'FM999,999,990') || ' HTG';

  IF NEW.type = 'deposit' THEN

    IF NEW.status = 'pending' THEN
      -- Client: deposit awaiting review
      INSERT INTO notifications (user_id, type, title, body, link, data)
      VALUES (
        v_user_id, 'info',
        'Dépôt en attente de confirmation',
        'Votre dépôt de ' || v_amount_fmt || ' est en cours de vérification. Délai habituel : 24–48h.',
        '/wallet',
        jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'method', NEW.payment_method)
      );
      -- Admins: new deposit proof to verify
      INSERT INTO notifications (user_id, type, title, body, link, data)
      SELECT
        uid, 'warning',
        'Preuve de dépôt à vérifier',
        'Un dépôt de ' || v_amount_fmt || ' via ' || COALESCE(NEW.payment_method, '?') || ' attend votre validation.',
        '/admin/wallet',
        jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'method', NEW.payment_method)
      FROM get_admin_user_ids() AS uid;

    ELSIF NEW.status = 'completed' THEN
      -- Client: deposit confirmed immediately (e.g. wallet-to-wallet)
      INSERT INTO notifications (user_id, type, title, body, link, data)
      VALUES (
        v_user_id, 'success',
        'Dépôt confirmé',
        'Votre dépôt de ' || v_amount_fmt || ' a été confirmé et crédité sur votre portefeuille.',
        '/wallet',
        jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
      );
    END IF;

  ELSIF NEW.type = 'payment' AND NEW.status = 'completed' THEN
    INSERT INTO notifications (user_id, type, title, body, link, data)
    VALUES (
      v_user_id, 'info',
      'Paiement débité',
      COALESCE(NEW.description, 'Un paiement de ' || v_amount_fmt || ' a été effectué depuis votre portefeuille.'),
      '/wallet',
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount, 'reference', NEW.reference)
    );

  ELSIF NEW.type = 'refund' AND NEW.status = 'completed' THEN
    INSERT INTO notifications (user_id, type, title, body, link, data)
    VALUES (
      v_user_id, 'success',
      'Remboursement reçu',
      'Un remboursement de ' || v_amount_fmt || ' a été crédité sur votre portefeuille.',
      '/wallet',
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
    );

  ELSIF NEW.type = 'adjustment' THEN
    INSERT INTO notifications (user_id, type, title, body, link, data)
    VALUES (
      v_user_id, 'info',
      'Ajustement de portefeuille',
      COALESCE(NEW.description, 'Un ajustement de ' || v_amount_fmt || ' a été appliqué à votre portefeuille.'),
      '/wallet',
      jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
    );

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_notify_wallet_insert ON wallet_transactions;
CREATE TRIGGER trg_auto_notify_wallet_insert
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_wallet_transaction();

-- ──────────────────────────────────────────────────
-- 4. Deposit confirmed by admin (pending → completed)
-- ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_notify_deposit_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id    uuid;
  v_amount_fmt text;
BEGIN
  IF NOT (OLD.type = 'deposit' AND OLD.status = 'pending' AND NEW.status = 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT w.user_id INTO v_user_id FROM wallets w WHERE w.id = NEW.wallet_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_amount_fmt := to_char(NEW.amount, 'FM999,999,990') || ' HTG';

  INSERT INTO notifications (user_id, type, title, body, link, data)
  VALUES (
    v_user_id, 'success',
    'Dépôt confirmé — Portefeuille crédité',
    'Votre dépôt de ' || v_amount_fmt || ' a été validé. Le solde est maintenant disponible dans votre portefeuille.',
    '/wallet',
    jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_notify_deposit_confirmed ON wallet_transactions;
CREATE TRIGGER trg_auto_notify_deposit_confirmed
  AFTER UPDATE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_notify_deposit_confirmed();
