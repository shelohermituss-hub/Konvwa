-- Daily automatic posters on Facebook + Instagram: 5 products a day from 7:00 (Haiti), never twice the same product, with an on/off switch for the admin.
-- The database decides everything (which product, when, how many); the Edge Function `facebook-post` (action autopost) only draws the poster and posts it.

-- ── What has been posted, by anyone: one row per product, so that a product never gets a second poster ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_posts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source             text NOT NULL CHECK (source IN ('auto', 'manual')),
  status             text NOT NULL CHECK (status IN ('pending', 'posted', 'failed')),
  facebook_post_id   text,
  instagram_media_id text,
  error              text,
  attempts           integer NOT NULL DEFAULT 1 CHECK (attempts >= 0),
  /** Day in Haiti of the last attempt (the daily budget is counted on it). */
  local_day          date NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_product_uidx ON public.social_posts (product_id);
CREATE INDEX IF NOT EXISTS social_posts_day_idx ON public.social_posts (source, local_day);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
-- read by the staff only; nobody writes from the browser (the Edge Function and the functions below use their own rights)
DROP POLICY IF EXISTS social_posts_admin_read ON public.social_posts;
CREATE POLICY social_posts_admin_read ON public.social_posts FOR SELECT TO authenticated USING (public.is_admin());

-- ── Settings: the switch (off by default) and the secret that proves a call comes from the job ──────────────────────────────────────────
INSERT INTO public.app_settings (key, value, label, description, sensitive) VALUES
  ('auto_post_enabled', 'false', 'Publication automatique des affiches', 'true = 5 produits par jour sur Facebook et Instagram à partir de 7h (Haïti).', true),
  ('auto_post_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'Secret de la publication automatique', 'Généré automatiquement : ne pas modifier.', true)
ON CONFLICT (key) DO NOTHING;

-- ── The dispatcher: picks the next product and asks the Edge Function to post it ────────────────────────────────────────────────────────
-- p_force = true (the admin's "try now" button) skips the switch, the opening hour, the daily budget and the spacing, but never the "one poster per product" rule.
CREATE OR REPLACE FUNCTION public.autopost_dispatch(p_force boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c_per_day    constant integer := 5;
  c_start_hour constant integer := 7;
  c_gap        constant interval := interval '55 minutes';
  v_local      timestamp := now() AT TIME ZONE 'America/Port-au-Prince';
  v_day        date := (now() AT TIME ZONE 'America/Port-au-Prince')::date;
  v_secret     text;
  v_product    uuid;
  v_row        uuid;
BEGIN
  IF NOT p_force THEN
    IF coalesce((SELECT value FROM app_settings WHERE key = 'auto_post_enabled'), 'false') <> 'true' THEN RETURN 'disabled'; END IF;
    IF extract(hour FROM v_local) < c_start_hour THEN RETURN 'too_early'; END IF;
  END IF;

  -- an attempt that never got an answer (function stopped) does not block the next ones
  UPDATE social_posts SET status = 'failed', error = coalesce(error, 'La publication n''a pas répondu à temps.'), updated_at = now()
   WHERE source = 'auto' AND status = 'pending' AND updated_at < now() - interval '15 minutes';
  IF EXISTS (SELECT 1 FROM social_posts WHERE source = 'auto' AND status = 'pending') THEN RETURN 'busy'; END IF;

  IF NOT p_force THEN
    IF (SELECT count(*) FROM social_posts WHERE source = 'auto' AND local_day = v_day) >= c_per_day THEN RETURN 'done_today'; END IF;
    IF EXISTS (SELECT 1 FROM social_posts WHERE source = 'auto' AND updated_at > now() - c_gap) THEN RETURN 'spacing'; END IF;
  END IF;

  SELECT value INTO v_secret FROM app_settings WHERE key = 'auto_post_secret';
  IF v_secret IS NULL THEN RETURN 'no_secret'; END IF;

  -- a visible retail product with a picture and a price that has no poster yet (a failed attempt is retried once, on another day)
  SELECT p.id INTO v_product FROM products p
   WHERE p.active AND p.stock_available AND NOT p.wholesale_only AND p.sale_type = 'retail' AND p.price_htg > 0
     AND coalesce(array_length(p.images, 1), 0) > 0
     AND NOT EXISTS (SELECT 1 FROM social_posts s WHERE s.product_id = p.id AND NOT (s.status = 'failed' AND s.attempts < 2 AND s.local_day < v_day))
   ORDER BY random() LIMIT 1;
  IF v_product IS NULL THEN RETURN 'nothing_to_post'; END IF;

  INSERT INTO social_posts (product_id, source, status, local_day) VALUES (v_product, 'auto', 'pending', v_day)
  ON CONFLICT (product_id) DO UPDATE
    SET source = 'auto', status = 'pending', attempts = social_posts.attempts + 1, local_day = v_day, error = NULL, updated_at = now()
    WHERE social_posts.status = 'failed'
  RETURNING id INTO v_row;
  IF v_row IS NULL THEN RETURN 'race'; END IF;

  PERFORM net.http_post(
    url => 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/facebook-post',
    headers => jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body => jsonb_build_object('action', 'autopost', 'product_id', v_product),
    timeout_milliseconds => 150000
  );
  RETURN 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.autopost_dispatch(boolean) FROM PUBLIC, anon, authenticated;

-- The job: every 10 minutes; most of the time it does nothing (switch off, before 7:00, day's budget reached, too soon after the last poster)
CREATE OR REPLACE FUNCTION public.autopost_tick()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT public.autopost_dispatch(false) $$;
REVOKE ALL ON FUNCTION public.autopost_tick() FROM PUBLIC, anon, authenticated;

-- The admin's "post one now" button (a test, or a poster on demand)
CREATE OR REPLACE FUNCTION public.admin_autopost_now()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN public.autopost_dispatch(true);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_autopost_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_autopost_now() TO authenticated;

SELECT cron.schedule('konvwa-auto-post', '*/10 * * * *', 'SELECT public.autopost_tick()');
