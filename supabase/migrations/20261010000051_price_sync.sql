-- Nightly price follow-up of products imported from a supplier page (first: Muscle & Strength).
-- The Edge Function `price-sync` reads the supplier page; ALL price arithmetic is done here, in the database.
-- A price moves by the same ratio as the supplier's price (so the admin's own margin is kept); a change above 15 % waits for the admin.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_sync boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_price_usd numeric(12,2) CONSTRAINT products_source_price_usd_check CHECK (source_price_usd IS NULL OR source_price_usd > 0),
  ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_price_sync_due ON products (price_checked_at NULLS FIRST) WHERE price_sync AND active;

CREATE TABLE IF NOT EXISTS price_sync_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  checked_at  timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL CHECK (status IN ('updated', 'review', 'accepted', 'refused', 'error')),
  old_usd     numeric(12,2),
  new_usd     numeric(12,2),
  old_htg     numeric,
  new_htg     numeric,
  promos      jsonb NOT NULL DEFAULT '[]'::jsonb CONSTRAINT price_sync_log_promos_array CHECK (jsonb_typeof(promos) = 'array'),
  note        text CHECK (note IS NULL OR char_length(note) <= 300),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_price_sync_log_product ON price_sync_log (product_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_sync_log_pending ON price_sync_log (checked_at DESC) WHERE status = 'review' AND resolved_at IS NULL;

ALTER TABLE price_sync_log ENABLE ROW LEVEL SECURITY;
-- read: admins only; no write policy at all (the service role and the functions below are the only writers)
CREATE POLICY price_sync_log_admin_read ON price_sync_log FOR SELECT TO authenticated USING (is_admin());

-- Applies a supplier price (and the quantity offers found on the page) to a product, atomically.
--   p_new_usd : the supplier's regular price now; p_promos : [{min_qty, unit_usd}] built from "2 for $40" / "buy 1 get 1 free" banners.
-- Product, manual tiers and variants move by new/old; tiers marked src = 'sync' are rebuilt from the offers of the day (an offer that is gone disappears).
CREATE OR REPLACE FUNCTION public.apply_price_sync(p_product uuid, p_new_usd numeric, p_promos jsonb DEFAULT '[]'::jsonb, p_review uuid DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        products%ROWTYPE;
  v_ratio  numeric := 1;
  v_htg    numeric;
  v_tiers  jsonb;
  v_promo  jsonb;
  v_unit   numeric;
  v_status text := 'unchanged';
BEGIN
  IF p_new_usd IS NULL OR p_new_usd <= 0 THEN RAISE EXCEPTION 'invalid supplier price'; END IF;
  SELECT * INTO p FROM products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown product'; END IF;

  IF p.source_price_usd IS NOT NULL THEN v_ratio := p_new_usd / p.source_price_usd; END IF;
  v_htg := CASE WHEN v_ratio = 1 THEN p.price_htg ELSE ceil(p.price_htg * v_ratio / 5) * 5 END;
  IF v_htg <= 0 THEN RAISE EXCEPTION 'invalid price'; END IF;

  SELECT coalesce(jsonb_agg(
           CASE WHEN v_ratio = 1 THEN t ELSE jsonb_set(t, '{price_htg}', to_jsonb(ceil((t->>'price_htg')::numeric * v_ratio / 5) * 5)) END
           ORDER BY (t->>'min_qty')::integer), '[]'::jsonb)
    INTO v_tiers
    FROM jsonb_array_elements(p.price_tiers) t
   WHERE coalesce(t->>'src', '') <> 'sync';

  FOR v_promo IN SELECT * FROM jsonb_array_elements(coalesce(p_promos, '[]'::jsonb)) LOOP
    v_unit := ceil((v_promo->>'unit_usd')::numeric * (v_htg / p_new_usd) / 5) * 5;
    IF (v_promo->>'min_qty')::integer > p.moq AND v_unit > 0 AND v_unit < v_htg
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_tiers) m WHERE (m->>'min_qty')::integer = (v_promo->>'min_qty')::integer) THEN
      v_tiers := v_tiers || jsonb_build_array(jsonb_build_object('min_qty', (v_promo->>'min_qty')::integer, 'price_htg', v_unit, 'src', 'sync'));
    END IF;
  END LOOP;
  SELECT coalesce(jsonb_agg(t ORDER BY (t->>'min_qty')::integer), '[]'::jsonb) INTO v_tiers FROM jsonb_array_elements(v_tiers) t;

  IF v_htg <> p.price_htg OR v_tiers IS DISTINCT FROM p.price_tiers THEN
    v_status := 'updated';
    IF v_ratio <> 1 THEN
      UPDATE product_variants SET price_htg = ceil(price_htg * v_ratio / 5) * 5 WHERE product_id = p_product;
    END IF;
    INSERT INTO price_sync_log (product_id, status, old_usd, new_usd, old_htg, new_htg, promos)
    VALUES (p_product, 'updated', p.source_price_usd, p_new_usd, p.price_htg, v_htg, coalesce(p_promos, '[]'::jsonb));
  END IF;

  UPDATE products SET price_htg = v_htg, price_tiers = v_tiers, source_price_usd = p_new_usd, price_checked_at = now() WHERE id = p_product;
  IF p_review IS NOT NULL THEN
    UPDATE price_sync_log SET status = 'accepted', resolved_at = now() WHERE id = p_review AND status = 'review';
  END IF;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_price_sync(uuid, numeric, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_price_sync(uuid, numeric, jsonb, uuid) TO service_role;

-- The admin accepts or refuses a price change that was too large to apply alone.
-- Refusing keeps the shop's price and takes the supplier's new price as the new reference (so it is not proposed again tomorrow).
CREATE OR REPLACE FUNCTION public.admin_resolve_price_review(p_log uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l price_sync_log%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM price_sync_log WHERE id = p_log FOR UPDATE;
  IF NOT FOUND OR l.status <> 'review' OR l.resolved_at IS NOT NULL THEN RAISE EXCEPTION 'already resolved'; END IF;
  IF p_accept THEN
    PERFORM apply_price_sync(l.product_id, l.new_usd, l.promos, p_log);
  ELSE
    UPDATE products SET source_price_usd = l.new_usd, price_checked_at = now() WHERE id = l.product_id;
    UPDATE price_sync_log SET status = 'refused', resolved_at = now() WHERE id = p_log;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_price_review(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_price_review(uuid, boolean) TO authenticated;

-- Secret that proves a call to the Edge Function comes from the nightly job (sensitive: readable by admins only)
INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('price_sync_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'Secret de la vérification nocturne des prix', 'Généré automatiquement : ne pas modifier.', true)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_price_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE price_sync AND active AND source_url IS NOT NULL AND (price_checked_at IS NULL OR price_checked_at < now() - interval '20 hours')) THEN RETURN; END IF;
  SELECT value INTO v_secret FROM app_settings WHERE key = 'price_sync_secret';
  IF v_secret IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(
    url => 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/price-sync',
    headers => jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body => '{}'::jsonb,
    timeout_milliseconds => 120000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.run_price_sync() FROM PUBLIC, anon, authenticated;

-- Every day between 07:00 and 09:30 UTC (3:00 to 5:30 in Haiti in summer, 2:00 to 4:30 in winter): after the US stores have changed their offers
-- of the day, before the Haitian morning. Once every product has been checked the job does nothing (no page is read, nothing is billed).
SELECT cron.schedule('konvwa-price-sync', '*/30 7-9 * * *', 'SELECT public.run_price_sync()');

-- Muscle & Strength products already in the catalogue join the follow-up (their first check only records the reference price)
UPDATE products SET price_sync = true WHERE supplier_name = 'Muscle & Strength' AND source_url LIKE 'https://www.muscleandstrength.com/%';
