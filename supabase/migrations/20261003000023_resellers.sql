-- Resellers: approved status, reseller prices, wholesale-only products, sales ledger

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_reseller boolean NOT NULL DEFAULT false;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reseller_discount_pct numeric NOT NULL DEFAULT 0 CHECK (reseller_discount_pct >= 0 AND reseller_discount_pct <= 60),
  ADD COLUMN IF NOT EXISTS wholesale_only boolean NOT NULL DEFAULT false;

-- a client can never flip their own reseller flag (only the SECURITY DEFINER review function can)
CREATE OR REPLACE FUNCTION public.guard_profile_reseller()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'UPDATE' THEN NEW.is_reseller := OLD.is_reseller; ELSE NEW.is_reseller := false; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_profile_reseller
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_reseller();

CREATE OR REPLACE FUNCTION public.is_reseller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = (SELECT auth.uid()) AND is_reseller) $$;
REVOKE EXECUTE ON FUNCTION public.is_reseller() FROM PUBLIC;
-- anon too: the products policies call it and Postgres does not guarantee short-circuit order (it returns false without a session)
GRANT EXECUTE ON FUNCTION public.is_reseller() TO anon, authenticated;

-- wholesale-only products are invisible to everyone but resellers and the team
ALTER POLICY products_select ON public.products
  USING ((SELECT auth.uid()) IS NOT NULL AND (NOT wholesale_only OR is_reseller() OR is_admin()));
ALTER POLICY products_auth_read ON public.products
  USING ((is_active = true AND (NOT wholesale_only OR is_reseller())) OR is_admin());

-- the order function applies the reseller price and refuses wholesale-only products to others
DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.create_product_order(jsonb, text)'::regprocedure);
  n := replace(d, '    IF NOT v_prod.stock_available THEN',
    E'    IF v_prod.wholesale_only AND NOT is_reseller() THEN\n      RAISE EXCEPTION ''Produit réservé aux revendeurs'';\n    END IF;\n    IF NOT v_prod.stock_available THEN');
  IF n = d THEN RAISE EXCEPTION 'stock anchor not found'; END IF;
  d := n;
  n := replace(d, '    v_price := tier_price(v_prod.price_htg, v_prod.price_tiers, v_qty);',
    E'    v_price := tier_price(v_prod.price_htg, v_prod.price_tiers, v_qty);\n    IF v_prod.reseller_discount_pct > 0 AND is_reseller() THEN\n      v_price := round(v_price * (1 - v_prod.reseller_discount_pct / 100), 2);\n    END IF;');
  IF n = d THEN RAISE EXCEPTION 'price anchor not found'; END IF;
  EXECUTE n;
END;
$$;

CREATE TABLE IF NOT EXISTS public.reseller_applications (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name    text NOT NULL CHECK (length(business_name) BETWEEN 2 AND 120),
  activity         text NOT NULL DEFAULT '' CHECK (length(activity) <= 500),
  monthly_volume_htg numeric NOT NULL DEFAULT 0 CHECK (monthly_volume_htg >= 0),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid,
  reviewed_at      timestamptz,
  reject_reason    text
);
ALTER TABLE public.reseller_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY reseller_applications_select ON public.reseller_applications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR is_admin());

CREATE OR REPLACE FUNCTION public.apply_reseller(p_business_name text, p_activity text, p_monthly_volume numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  IF length(trim(coalesce(p_business_name, ''))) < 2 OR length(p_business_name) > 120 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le nom de votre activité.');
  END IF;
  IF EXISTS (SELECT 1 FROM reseller_applications WHERE user_id = v_uid AND status = 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous êtes déjà revendeur.');
  END IF;

  INSERT INTO reseller_applications (user_id, business_name, activity, monthly_volume_htg, status, submitted_at)
  VALUES (v_uid, trim(p_business_name), left(coalesce(p_activity, ''), 500), greatest(coalesce(p_monthly_volume, 0), 0), 'pending', now())
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name, activity = EXCLUDED.activity, monthly_volume_htg = EXCLUDED.monthly_volume_htg,
    status = 'pending', submitted_at = now(), reviewed_by = NULL, reviewed_at = NULL, reject_reason = NULL;

  PERFORM notify_once(uid, 'info', 'Demande de statut revendeur',
    trim(p_business_name) || ' demande le statut revendeur.', '/admin/resellers', jsonb_build_object('user_id', v_uid))
    FROM get_admin_user_ids() AS uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_reseller(p_user_id uuid, p_approve boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reason text := left(trim(coalesce(p_reason, '')), 200);
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF NOT p_approve AND v_reason = '' THEN RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif du refus.'); END IF;

  UPDATE reseller_applications
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = (SELECT auth.uid()), reviewed_at = now(),
         reject_reason = CASE WHEN p_approve THEN NULL ELSE v_reason END
   WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.'); END IF;

  UPDATE profiles SET is_reseller = p_approve WHERE user_id = p_user_id;

  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  VALUES (p_user_id, CASE WHEN p_approve THEN 'success' ELSE 'warning' END,
          CASE WHEN p_approve THEN 'Vous êtes revendeur KONVWA' ELSE 'Demande revendeur refusée' END,
          CASE WHEN p_approve THEN 'Les prix revendeur et le catalogue en gros sont disponibles.' ELSE 'Votre demande a été refusée : ' || v_reason END,
          CASE WHEN p_approve THEN 'You are a KONVWA reseller' ELSE 'Reseller request declined' END,
          CASE WHEN p_approve THEN 'Reseller prices and the wholesale catalog are now available.' ELSE 'Your request was declined: ' || v_reason END,
          '/reseller');
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_reseller(text, text, numeric), public.admin_review_reseller(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_reseller(text, text, numeric), public.admin_review_reseller(uuid, boolean, text) TO authenticated;

-- Sales a reseller records for their own business (margin dashboard); not money held by us
CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_label  text NOT NULL CHECK (length(product_label) BETWEEN 1 AND 160),
  customer       text CHECK (customer IS NULL OR length(customer) <= 120),
  quantity       integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  unit_cost_htg  numeric NOT NULL CHECK (unit_cost_htg >= 0 AND unit_cost_htg <= 100000000),
  unit_price_htg numeric NOT NULL CHECK (unit_price_htg >= 0 AND unit_price_htg <= 100000000),
  sold_on        date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reseller_sales_user_idx ON public.reseller_sales (user_id, sold_on DESC);
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY reseller_sales_select ON public.reseller_sales FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY reseller_sales_insert ON public.reseller_sales FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND is_reseller());
CREATE POLICY reseller_sales_delete ON public.reseller_sales FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));
