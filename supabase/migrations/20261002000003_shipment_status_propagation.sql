-- ============================================================
-- KONVWA — One status vocabulary for orders, shipment batches and cargo requests
--
-- Shipment batch statuses are now the order-tracking statuses that apply to a batch:
--   in_china_warehouse -> shipped -> in_transit -> arrived_haiti
--   -> customs_processing -> out_for_delivery -> delivered
-- (draft, quote_*, awaiting_payment, paid, purchasing, closed, cancelled do not apply)
--
-- Changing a batch status updates every assigned order and notifies the clients of
-- assigned cargo requests; cargo tracking is read from the batch it is assigned to.
-- ============================================================

-- ── 1. Migrate existing batches to the new vocabulary ────────
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;

UPDATE shipments SET status = CASE status
  WHEN 'pending'       THEN 'in_china_warehouse'
  WHEN 'consolidating' THEN 'in_china_warehouse'
  WHEN 'packed'        THEN 'in_china_warehouse'
  WHEN 'loaded'        THEN 'shipped'
  WHEN 'sailing'       THEN 'in_transit'
  WHEN 'arrived'       THEN 'arrived_haiti'
  WHEN 'cleared'       THEN 'customs_processing'
  WHEN 'distributing'  THEN 'out_for_delivery'
  WHEN 'completed'     THEN 'delivered'
  ELSE status
END
WHERE status IN ('pending', 'consolidating', 'packed', 'loaded', 'sailing', 'arrived', 'cleared', 'distributing', 'completed');

ALTER TABLE shipments ADD CONSTRAINT shipments_status_check
  CHECK (status IN ('in_china_warehouse', 'shipped', 'in_transit', 'arrived_haiti',
                    'customs_processing', 'out_for_delivery', 'delivered'));

ALTER TABLE shipments ALTER COLUMN status SET DEFAULT 'in_china_warehouse';

-- ── 2. Batch status -> order status (identity once the batch has left the warehouse)
CREATE OR REPLACE FUNCTION order_status_for_shipment(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_status IN ('shipped', 'in_transit', 'arrived_haiti',
                      'customs_processing', 'out_for_delivery', 'delivered')
    THEN p_status
    ELSE NULL
  END;
$$;

-- ── 3. Orders: notify only on milestones, with the real status names ─────────
CREATE OR REPLACE FUNCTION auto_notify_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    WHEN 'quote_sent' THEN
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
        v_link  := '/shipments';
      ELSE
        RETURN NEW;
      END IF;

    WHEN 'shipped' THEN
      v_title := 'Expédiée depuis la Chine — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en route vers Haïti.';
      v_type  := 'success';

    WHEN 'arrived_haiti' THEN
      v_title := 'Arrivée en Haïti — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est arrivée en Haïti. Le dédouanement va commencer.';
      v_type  := 'success';

    WHEN 'out_for_delivery' THEN
      v_title := 'Livraison en cours — ' || NEW.tracking_code;
      v_body  := 'Votre commande ' || NEW.tracking_code || ' est en cours de livraison. Soyez disponible à votre adresse.';
      v_type  := 'info';

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
      -- purchasing, in_transit, customs_processing…: visible in order tracking, no notification
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

-- ── 4. Batch status change: propagate to orders + notify cargo clients ───────
-- (function keeps its historical name because the trigger already points to it)
CREATE OR REPLACE FUNCTION notify_balance_due_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_status text;
  pr             record;
  v_title        text;
  v_body         text;
  v_rest         numeric;
  v_code         text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  -- Assigned orders follow the batch (their own trigger sends the notifications)
  v_order_status := order_status_for_shipment(NEW.status);
  IF v_order_status IS NOT NULL THEN
    UPDATE orders o
       SET status = v_order_status, updated_at = now()
      FROM order_shipments os
     WHERE os.shipment_id = NEW.id
       AND os.order_id = o.id
       AND o.status <> v_order_status
       AND o.status IN ('paid', 'purchasing', 'in_china_warehouse', 'shipped', 'in_transit',
                        'arrived_haiti', 'customs_processing', 'out_for_delivery');
  END IF;

  -- Assigned cargo requests: milestone notifications (same milestones as orders)
  IF NEW.status IN ('shipped', 'arrived_haiti', 'out_for_delivery', 'delivered') THEN
    FOR pr IN
      SELECT id, user_id, status, quoted_amount_htg, paid_amount_htg
        FROM product_requests
       WHERE request_type = 'shipping'
         AND shipment_id = NEW.id
         AND status IN ('invoiced', 'deposit_paid')
    LOOP
      v_code := upper(left(pr.id::text, 8));
      v_rest := CASE WHEN pr.status = 'deposit_paid'
                     THEN GREATEST(COALESCE(pr.quoted_amount_htg, 0) - COALESCE(pr.paid_amount_htg, 0), 0)
                     ELSE 0 END;

      v_title := CASE NEW.status
        WHEN 'shipped'          THEN 'Cargaison expédiée — #' || v_code
        WHEN 'arrived_haiti'    THEN 'Cargaison arrivée en Haïti — #' || v_code
        WHEN 'out_for_delivery' THEN 'Livraison en cours — #' || v_code
        ELSE                         'Cargaison livrée — #' || v_code
      END;
      v_body := CASE NEW.status
        WHEN 'shipped'          THEN 'Votre cargaison a quitté l''entrepôt et est en route vers Haïti.'
        WHEN 'arrived_haiti'    THEN 'Votre cargaison est arrivée en Haïti. Le dédouanement va commencer.'
        WHEN 'out_for_delivery' THEN 'Votre cargaison est en cours de livraison. Soyez disponible à votre adresse.'
        ELSE                         'Votre cargaison a été livrée. Merci de votre confiance chez Konvwa !'
      END;

      IF v_rest > 0 AND NEW.status IN ('arrived_haiti', 'out_for_delivery') THEN
        v_body := v_body || ' Solde de ' || to_char(v_rest, 'FM999,999,990')
                         || ' HTG à régler à la livraison (ou dès maintenant depuis votre portefeuille).';
      END IF;

      PERFORM notify_once(
        pr.user_id,
        CASE WHEN v_rest > 0 AND NEW.status IN ('arrived_haiti', 'out_for_delivery') THEN 'warning' ELSE 'success' END,
        v_title, v_body, '/shipments/' || pr.id,
        jsonb_build_object('request_id', pr.id, 'shipment_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 5. Order assigned to a batch already under way: align its status ─────────
CREATE OR REPLACE FUNCTION sync_order_on_shipment_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ship_status  text;
  v_order_status text;
BEGIN
  SELECT status INTO v_ship_status FROM shipments WHERE id = NEW.shipment_id;
  v_order_status := order_status_for_shipment(v_ship_status);

  IF v_order_status IS NOT NULL THEN
    UPDATE orders
       SET status = v_order_status, updated_at = now()
     WHERE id = NEW.order_id
       AND status <> v_order_status
       AND status IN ('paid', 'purchasing', 'in_china_warehouse', 'shipped', 'in_transit',
                      'arrived_haiti', 'customs_processing', 'out_for_delivery');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_on_shipment_assignment
  AFTER INSERT ON order_shipments
  FOR EACH ROW EXECUTE FUNCTION sync_order_on_shipment_assignment();

REVOKE ALL ON FUNCTION sync_order_on_shipment_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION auto_notify_order_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_balance_due_on_delivery() FROM PUBLIC, anon, authenticated;
