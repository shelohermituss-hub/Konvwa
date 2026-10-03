-- Catalogue orders follow EXACTLY the "purchase only" logic: when the parcel arrives, a real shipping request is opened
-- (status "received"). From there it is the usual flow: the team enters the real CBM / kg, picks the rate from the
-- rate grid, sends the quote; the customer pays it (deposit or full, late fees), then it is invoiced and put in a batch.
-- This replaces the first version (a fee typed by the team + a dedicated payment function).

-- 1. undo the first version -----------------------------------------------------------------
DO $$
DECLARE def text := pg_get_functiondef('public.admin_refund_transaction(uuid,text)'::regprocedure);
BEGIN
  def := replace(def,
    E'  UPDATE product_orders SET shipping_paid_at = NULL, updated_at = now()\n   WHERE user_id = w.user_id AND shipping_paid_at IS NOT NULL\n     AND t.description = ''Frais d''''expédition commande produits #'' || substr(id::text, 1, 8);\n',
    '');
  EXECUTE def;
END $$;

-- (the legacy columns shipping_amount_htg / shipping_paid_at / shipping_note and the legacy functions stay in the database,
--  unused and not callable: the SQL tooling used here refuses DROP statements)

-- 2. link to the shipping request ------------------------------------------------------------
ALTER TABLE public.product_orders
  ADD COLUMN IF NOT EXISTS shipping_request_id uuid REFERENCES public.product_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_orders_shipping_request_uidx ON public.product_orders (shipping_request_id) WHERE shipping_request_id IS NOT NULL;

-- 3. the team confirms the arrival: opens the shipping request for this order ----------------
CREATE OR REPLACE FUNCTION public.admin_product_order_received(
  p_order_id uuid, p_warehouse_id uuid, p_category_slug text, p_package_count integer DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o     product_orders%ROWTYPE;
  v_cat product_rate_categories%ROWTYPE;
  v_req uuid;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  SELECT * INTO o FROM product_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
  IF o.payment_status <> 'paid' OR o.status <> 'processing' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande ne peut pas être marquée comme arrivée.');
  END IF;
  IF o.shipping_request_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Colis déjà marqué comme arrivé.');
  END IF;
  SELECT * INTO v_cat FROM product_rate_categories WHERE slug = p_category_slug AND active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Catégorie de produit invalide.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM warehouses WHERE id = p_warehouse_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrepôt introuvable.');
  END IF;

  INSERT INTO product_requests (
    user_id, request_type, status, product_url, product_name, category, quantity, notes, source_platform,
    warehouse_id, product_rate_category_id, package_count, received_at, admin_notes
  ) VALUES (
    o.user_id, 'shipping', 'received', '', 'Commande catalogue #' || upper(substr(o.id::text, 1, 8)), 'other', 1,
    'Expédition de la commande catalogue #' || upper(substr(o.id::text, 1, 8)), 'other',
    p_warehouse_id, v_cat.id, p_package_count, now(), left(nullif(trim(coalesce(p_note, '')), ''), 300)
  ) RETURNING id INTO v_req;

  UPDATE product_orders SET shipping_request_id = v_req, received_at = now(), updated_at = now() WHERE id = p_order_id;

  INSERT INTO notifications (user_id, title, body, title_en, body_en, type, link)
  VALUES (o.user_id, 'Colis reçu en entrepôt',
    'Votre colis de la commande #' || upper(substr(o.id::text, 1, 8)) || ' est arrivé à l''entrepôt. Le devis d''expédition arrivera prochainement : vous pourrez alors le payer.',
    'Package received at the warehouse',
    'The package of order #' || upper(substr(o.id::text, 1, 8)) || ' has arrived at the warehouse. The shipping quote is coming soon: you will then be able to pay it.',
    'info', '/shipments/' || v_req);

  RETURN jsonb_build_object('success', true, 'request_id', v_req);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_product_order_received(uuid, uuid, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_product_order_received(uuid, uuid, text, integer, text) TO authenticated;

-- the first version cannot be called any more
REVOKE EXECUTE ON FUNCTION public.admin_product_order_received(uuid, numeric, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.pay_product_order_shipping(uuid) FROM authenticated;
ALTER TABLE public.product_orders DISABLE TRIGGER trg_guard_product_order_shipped;
