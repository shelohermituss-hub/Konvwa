-- New step "Expédition payée" for separate-shipping and catalogue orders: paying the shipping puts the order (and its cargo) straight
-- at that status; the team can then assign the order to an expedition (batch) directly, and the cargo statuses follow.

-- 1. allowed statuses
ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY['draft','quote_sent','quote_accepted','awaiting_payment','paid','purchasing','in_china_warehouse','shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered','closed','cancelled']));
ALTER TABLE public.product_orders DROP CONSTRAINT product_orders_tracking_status_check;
ALTER TABLE public.product_orders ADD CONSTRAINT product_orders_tracking_status_check CHECK (tracking_status IS NULL OR tracking_status = ANY (ARRAY['paid','purchasing','in_china_warehouse','shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered']));
ALTER TABLE public.product_requests DROP CONSTRAINT product_requests_tracking_status_check;
ALTER TABLE public.product_requests ADD CONSTRAINT product_requests_tracking_status_check CHECK (tracking_status IS NULL OR tracking_status = ANY (ARRAY['in_china_warehouse','shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered']));

-- 2. patches of existing functions
DO $$
DECLARE def text; new_def text;
BEGIN
  -- the arrival function notifies the customer itself (with the right link): the generic order trigger no longer does for the warehouse step
  def := pg_get_functiondef('public.auto_notify_order_status()'::regprocedure);
  new_def := replace(def, E'WHEN ''in_china_warehouse'' THEN\n      IF NEW.shipping_option = ''separate'' THEN', E'WHEN ''in_china_warehouse'' THEN\n      IF false THEN');
  IF new_def = def THEN RAISE EXCEPTION 'auto_notify_order_status: pattern not found'; END IF;
  EXECUTE new_def;

  -- paying the shipping puts the order and its cargo at "shipping_paid"
  def := pg_get_functiondef('public.pay_order_shipping(text,uuid,uuid)'::regprocedure);
  new_def := replace(def, E'''in_china_warehouse'', p_kind, p_id, v_label', E'''shipping_paid'', p_kind, p_id, v_label');
  new_def := replace(new_def, 'shipping_paid_at = now(), shipping_request_id = v_req,', E'shipping_paid_at = now(), shipping_request_id = v_req, status = ''shipping_paid'',');
  new_def := replace(new_def, 'UPDATE product_orders SET chosen_shipping_rate_id = p_rate_id,', E'UPDATE product_orders SET tracking_status = ''shipping_paid'', chosen_shipping_rate_id = p_rate_id,');
  IF new_def = def OR position('status = ''shipping_paid''' in new_def) = 0 OR position('tracking_status = ''shipping_paid'', chosen' in new_def) = 0 THEN
    RAISE EXCEPTION 'pay_order_shipping: pattern not found';
  END IF;
  EXECUTE new_def;

  def := pg_get_functiondef('public.admin_set_cargo_status(uuid,text)'::regprocedure);
  new_def := replace(def, '(''in_china_warehouse'',''shipped'',', '(''in_china_warehouse'',''shipping_paid'',''shipped'',');
  IF new_def = def THEN RAISE EXCEPTION 'admin_set_cargo_status: pattern not found'; END IF;
  EXECUTE new_def;
END $$;

-- a cargo assigned to a batch takes the batch status ("in_china_warehouse" = not left yet = "shipping_paid")
CREATE OR REPLACE FUNCTION public.guard_request_tracking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.tracking_status := OLD.tracking_status; NEW.source_order_kind := OLD.source_order_kind;
      NEW.source_order_id := OLD.source_order_id; NEW.source_order_label := OLD.source_order_label;
    ELSE
      NEW.tracking_status := NULL; NEW.source_order_kind := NULL; NEW.source_order_id := NULL; NEW.source_order_label := NULL;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.shipment_id IS NOT NULL AND NEW.shipment_id IS DISTINCT FROM OLD.shipment_id
     AND NEW.status IN ('invoiced', 'deposit_paid') AND NEW.tracking_status IS NOT DISTINCT FROM OLD.tracking_status THEN
    NEW.tracking_status := (SELECT CASE WHEN status = 'in_china_warehouse' THEN 'shipping_paid' ELSE status END FROM shipments WHERE id = NEW.shipment_id);
  END IF;
  IF NEW.tracking_status IS NOT NULL AND NEW.tracking_status <> 'in_china_warehouse'
     AND (TG_OP = 'INSERT' OR NEW.tracking_status IS DISTINCT FROM OLD.tracking_status)
     AND NEW.status NOT IN ('invoiced', 'deposit_paid') THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_product_orders_with_shipment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := CASE WHEN NEW.status = 'in_china_warehouse' THEN 'shipping_paid' ELSE NEW.status END;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE product_requests SET tracking_status = v, updated_at = now()
     WHERE shipment_id = NEW.id AND request_type = 'shipping' AND status IN ('invoiced', 'deposit_paid')
       AND tracking_status IS DISTINCT FROM v;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_product_order_tracking()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status AND NEW.tracking_status IN
     ('shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') AND NEW.shipping_paid_at IS NULL THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  IF NEW.tracking_status IS DISTINCT FROM OLD.tracking_status AND NEW.status <> 'cancelled' AND NEW.payment_status = 'paid' THEN
    NEW.status := CASE
      WHEN NEW.tracking_status = 'delivered' THEN 'delivered'
      WHEN NEW.tracking_status IN ('shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery') THEN 'shipped'
      ELSE 'processing' END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_separate_shipping_paid()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.shipping_option = 'separate' AND NEW.shipping_paid_at IS NULL
     AND NEW.status IN ('shipping_paid','shipped','in_transit','arrived_haiti','customs_processing','out_for_delivery','delivered') THEN
    RAISE EXCEPTION 'Le colis ne peut pas partir avant le paiement de l''expédition.';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. the team assigns an order (through its paid cargo) to an expedition / batch directly
CREATE OR REPLACE FUNCTION public.admin_assign_order_to_batch(p_kind text, p_id uuid, p_shipment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req uuid;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_kind = 'order' THEN SELECT shipping_request_id INTO v_req FROM orders WHERE id = p_id;
  ELSIF p_kind = 'product_order' THEN SELECT shipping_request_id INTO v_req FROM product_orders WHERE id = p_id;
  ELSE RETURN jsonb_build_object('success', false, 'error', 'Type de commande invalide.'); END IF;
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le client doit d''abord payer l''expédition de cette commande.');
  END IF;
  IF p_shipment_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shipments WHERE id = p_shipment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expédition introuvable.');
  END IF;
  PERFORM 1 FROM product_requests WHERE id = v_req AND status IN ('invoiced', 'deposit_paid') FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Le client doit d''abord payer l''expédition de cette commande.'); END IF;
  UPDATE product_requests SET shipment_id = p_shipment_id, updated_at = now() WHERE id = v_req;
  RETURN jsonb_build_object('success', true, 'request_id', v_req);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_assign_order_to_batch(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_order_to_batch(text, uuid, uuid) TO authenticated;

-- 4. orders whose shipping is already paid move to the new step (the cargo drives its orders)
UPDATE public.product_requests SET tracking_status = 'shipping_paid'
 WHERE source_order_id IS NOT NULL AND status IN ('invoiced', 'deposit_paid') AND tracking_status = 'in_china_warehouse';
