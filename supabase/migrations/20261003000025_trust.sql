-- Trust: package photos, optional insurance, delivery/pickup options by region, exchange rate frozen on quotes

-- ── 1. Package photos taken at the warehouse ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.package_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES public.product_requests(id) ON DELETE CASCADE,
  path        text NOT NULL CHECK (length(path) <= 300),
  caption     text CHECK (caption IS NULL OR length(caption) <= 200),
  uploaded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS package_photos_request_idx ON public.package_photos (request_id, created_at);
ALTER TABLE public.package_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_photos_select ON public.package_photos
  FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM product_requests pr WHERE pr.id = request_id AND pr.user_id = (SELECT auth.uid())));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('package-photos', 'package-photos', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY package_photos_obj_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'package-photos' AND is_admin()
    AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    AND (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'package-photos' AND o.owner = (SELECT auth.uid())
          AND o.created_at > now() - interval '1 hour') < 80
  );
CREATE POLICY package_photos_obj_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'package-photos'
    AND (is_admin() OR EXISTS (
      SELECT 1 FROM product_requests pr
       WHERE pr.id::text = (storage.foldername(name))[1] AND pr.user_id = (SELECT auth.uid())))
  );

CREATE OR REPLACE FUNCTION public.admin_add_package_photo(p_request_id uuid, p_path text, p_caption text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_req product_requests%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.'); END IF;
  IF p_path NOT LIKE p_request_id::text || '/%' THEN RETURN jsonb_build_object('success', false, 'error', 'Fichier invalide.'); END IF;

  INSERT INTO package_photos (request_id, path, caption, uploaded_by)
  VALUES (p_request_id, p_path, left(nullif(trim(p_caption), ''), 200), (SELECT auth.uid()));

  PERFORM public.remind(v_req.user_id, 'Photo de votre colis',
    'Une photo de votre colis à l''entrepôt est disponible.',
    'Photo of your package',
    'A photo of your package at the warehouse is available.',
    CASE WHEN v_req.request_type = 'shipping' THEN '/shipments/' || v_req.id ELSE '/orders' END, 1);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_add_package_photo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_add_package_photo(uuid, text, text) TO authenticated;

-- ── 2. Optional insurance on shipping requests ────────────────────────────────
ALTER TABLE public.product_requests
  ADD COLUMN IF NOT EXISTS insured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insured_value_usd numeric,
  ADD COLUMN IF NOT EXISTS insurance_fee_htg numeric,
  ADD COLUMN IF NOT EXISTS insured_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_option_id uuid;

INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('insurance_rate_percent', '3', 'Taux de l''assurance colis (%)', 'Prime = valeur déclarée × ce taux (convertie en HTG).', false),
  ('insurance_min_value_usd', '100', 'Valeur minimale assurable (USD)', 'En dessous, l''assurance n''est pas proposée.', false),
  ('insurance_max_value_usd', '5000', 'Valeur maximale assurable (USD)', 'Plafond de la valeur déclarée.', false)
ON CONFLICT (key) DO NOTHING;

-- insurance data can only be written by the function below (clients insert requests directly)
CREATE OR REPLACE FUNCTION public.guard_request_insurance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.insured := OLD.insured; NEW.insured_value_usd := OLD.insured_value_usd;
      NEW.insurance_fee_htg := OLD.insurance_fee_htg; NEW.insured_at := OLD.insured_at;
    ELSE
      NEW.insured := false; NEW.insured_value_usd := NULL; NEW.insurance_fee_htg := NULL; NEW.insured_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_request_insurance
  BEFORE INSERT OR UPDATE ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_request_insurance();

CREATE OR REPLACE FUNCTION public.buy_shipping_insurance(p_request_id uuid, p_value_usd numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  r         product_requests%ROWTYPE;
  v_pct     numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'insurance_rate_percent'), 3);
  v_min     numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'insurance_min_value_usd'), 100);
  v_max     numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'insurance_max_value_usd'), 5000);
  v_rate    numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140);
  v_fee     numeric;
  v_wallet  uuid;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  SELECT * INTO r FROM product_requests WHERE id = p_request_id AND user_id = v_uid AND request_type = 'shipping' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.'); END IF;
  IF r.status NOT IN ('quoted', 'received', 'deposit_paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'L''assurance n''est plus disponible pour cette demande.');
  END IF;
  IF r.insured THEN RETURN jsonb_build_object('success', false, 'error', 'Ce colis est déjà assuré.'); END IF;
  IF p_value_usd IS NULL OR p_value_usd < v_min OR p_value_usd > v_max THEN
    RETURN jsonb_build_object('success', false, 'error', 'Valeur déclarée entre ' || v_min::integer || ' et ' || v_max::integer || ' USD.');
  END IF;

  v_fee := ceil(p_value_usd * v_pct / 100 * v_rate);

  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible, ' || to_char(v_fee, 'FM999,999,990') || ' HTG requis).');
  END IF;
  IF NOT public.mfa_ok(v_fee) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required', 'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_fee, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', v_fee, 'completed', 'Assurance colis — demande #' || upper(left(p_request_id::text, 8)));

  -- the guard trigger lets this through: current_user is the function owner here
  UPDATE product_requests SET insured = true, insured_value_usd = p_value_usd, insurance_fee_htg = v_fee, insured_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'fee', v_fee);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.buy_shipping_insurance(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_shipping_insurance(uuid, numeric) TO authenticated;

-- ── 3. Delivery and pickup options by region (price shown before ordering) ────
CREATE TABLE IF NOT EXISTS public.delivery_options (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id  uuid NOT NULL REFERENCES public.haiti_regions(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('pickup', 'home')),
  label      text NOT NULL CHECK (length(label) BETWEEN 2 AND 120),
  details    text CHECK (details IS NULL OR length(details) <= 300),
  price_htg  numeric NOT NULL DEFAULT 0 CHECK (price_htg >= 0),
  active     boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS delivery_options_region_idx ON public.delivery_options (region_id);
ALTER TABLE public.delivery_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_options_select ON public.delivery_options FOR SELECT TO authenticated USING (active OR is_admin());
CREATE POLICY delivery_options_admin_insert ON public.delivery_options FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY delivery_options_admin_update ON public.delivery_options FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY delivery_options_admin_delete ON public.delivery_options FOR DELETE TO authenticated USING (is_admin());

ALTER TABLE public.product_requests
  ADD CONSTRAINT product_requests_delivery_option_fk FOREIGN KEY (delivery_option_id) REFERENCES public.delivery_options(id) ON DELETE SET NULL;

-- ── 4. Exchange rate frozen when a quote is created ───────────────────────────
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS usd_to_htg_rate numeric;

CREATE OR REPLACE FUNCTION public.freeze_quote_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.usd_to_htg_rate IS NULL THEN
    NEW.usd_to_htg_rate := (SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate');
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.freeze_quote_rate() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_freeze_quote_rate BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.freeze_quote_rate();
UPDATE public.quotes SET usd_to_htg_rate = (SELECT value::numeric FROM public.app_settings WHERE key = 'usd_to_htg_rate') WHERE usd_to_htg_rate IS NULL;
