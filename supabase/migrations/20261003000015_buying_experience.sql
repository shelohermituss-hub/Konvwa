-- Buying experience: dated order history, shipment progress alerts, verified reviews, wishlist

-- is_super_admin now follows the same MFA rule as is_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = (SELECT auth.uid()) AND role = 'admin')
     AND (
       coalesce((SELECT value FROM app_settings WHERE key = 'staff_mfa_required'), 'false') <> 'true'
       OR coalesce((SELECT auth.jwt()) ->> 'aal', '') = 'aal2'
     );
$$;

-- ── 1. Dated order history ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, status, created_by) VALUES (NEW.id, NEW.status, (SELECT auth.uid()));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_order_status() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_log_order_status
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- ── 2. Shipment progress → alert every client who has cargo in the batch ──────
CREATE OR REPLACE FUNCTION public.notify_shipment_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
  v_title_en text;
  v_body text;
  v_body_en text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;

  CASE NEW.status
    WHEN 'shipped' THEN
      v_title := 'Votre cargaison est expédiée'; v_title_en := 'Your cargo has shipped';
      v_body := 'Le lot ' || NEW.batch_code || ' a quitté l''entrepôt pour Haïti.';
      v_body_en := 'Batch ' || NEW.batch_code || ' has left the warehouse for Haiti.';
    WHEN 'in_transit' THEN
      v_title := 'Votre cargaison est en transit'; v_title_en := 'Your cargo is in transit';
      v_body := 'Le lot ' || NEW.batch_code || ' est en route vers Haïti.';
      v_body_en := 'Batch ' || NEW.batch_code || ' is on its way to Haiti.';
    WHEN 'arrived_haiti' THEN
      v_title := 'Votre cargaison est arrivée en Haïti'; v_title_en := 'Your cargo has arrived in Haiti';
      v_body := 'Le lot ' || NEW.batch_code || ' est arrivé en Haïti.';
      v_body_en := 'Batch ' || NEW.batch_code || ' has arrived in Haiti.';
    WHEN 'customs_processing' THEN
      v_title := 'Dédouanement en cours'; v_title_en := 'Customs clearance in progress';
      v_body := 'Le lot ' || NEW.batch_code || ' est en cours de dédouanement.';
      v_body_en := 'Batch ' || NEW.batch_code || ' is going through customs.';
    WHEN 'out_for_delivery' THEN
      v_title := 'Votre cargaison est en livraison'; v_title_en := 'Your cargo is out for delivery';
      v_body := 'Le lot ' || NEW.batch_code || ' est en cours de livraison.';
      v_body_en := 'Batch ' || NEW.batch_code || ' is out for delivery.';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  SELECT DISTINCT pr.user_id, 'info', v_title, v_body, v_title_en, v_body_en, '/shipments/' || pr.id
    FROM product_requests pr
   WHERE pr.shipment_id = NEW.id AND pr.status IN ('invoiced', 'deposit_paid');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_shipment_progress() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_shipment_progress
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.notify_shipment_progress();

-- ── 3. Verified reviews ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text NOT NULL DEFAULT '' CHECK (length(comment) <= 1000),
  photos      text[] NOT NULL DEFAULT '{}' CHECK (cardinality(photos) <= 3),
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON public.product_reviews (product_id, created_at DESC);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY product_reviews_select ON public.product_reviews
  FOR SELECT TO authenticated USING (hidden = false OR user_id = (SELECT auth.uid()) OR is_admin());
-- writes only through the functions below

CREATE OR REPLACE FUNCTION public.product_review_status(p_product_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'purchased', EXISTS (
      SELECT 1 FROM product_order_items i JOIN product_orders o ON o.id = i.order_id
       WHERE i.product_id = p_product_id AND o.user_id = (SELECT auth.uid()) AND o.payment_status = 'paid'),
    'reviewed', EXISTS (SELECT 1 FROM product_reviews r WHERE r.product_id = p_product_id AND r.user_id = (SELECT auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.submit_review(p_product_id uuid, p_rating integer, p_comment text, p_photos text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := (SELECT auth.uid());
  v_name   text;
  v_photos text[] := coalesce(p_photos, '{}');
  p        text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Note invalide.');
  END IF;
  IF length(coalesce(p_comment, '')) > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commentaire trop long.');
  END IF;
  IF cardinality(v_photos) > 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trois photos maximum.');
  END IF;
  FOREACH p IN ARRAY v_photos LOOP
    IF p NOT LIKE v_uid::text || '/%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Fichier invalide.');
    END IF;
  END LOOP;

  IF NOT (SELECT (product_review_status(p_product_id) ->> 'purchased')::boolean) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seuls les clients ayant acheté ce produit peuvent donner un avis.');
  END IF;

  SELECT coalesce(nullif(split_part(trim(full_name), ' ', 1), ''), 'Client')
         || coalesce(' ' || nullif(left(split_part(trim(full_name), ' ', 2), 1), '') || '.', '')
    INTO v_name FROM profiles WHERE user_id = v_uid;

  INSERT INTO product_reviews (product_id, user_id, author_name, rating, comment, photos)
  VALUES (p_product_id, v_uid, coalesce(v_name, 'Client'), p_rating, trim(coalesce(p_comment, '')), v_photos)
  ON CONFLICT (product_id, user_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, photos = EXCLUDED.photos, created_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  UPDATE product_reviews SET hidden = p_hidden WHERE id = p_review_id;
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.product_review_status(uuid), public.submit_review(uuid, integer, text, text[]),
  public.admin_set_review_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.product_review_status(uuid), public.submit_review(uuid, integer, text, text[]),
  public.admin_set_review_hidden(uuid, boolean) TO authenticated;

-- ── 4. Wishlist ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY wishlist_select ON public.wishlist_items FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY wishlist_insert ON public.wishlist_items FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY wishlist_delete ON public.wishlist_items FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS wishlist_items_product_idx ON public.wishlist_items (product_id);
