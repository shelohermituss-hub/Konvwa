-- Social media section: (1) the editorial calendar (event, explainer, news and promo posters proposed for months ahead, validated by the admin, then
-- published by a job), and (2) the times of the automatic product posters (the admin chooses how many a day and at what time, Haiti time).
-- The database decides everything (what is due, how many); the Edge Function `facebook-post` (action calendar_post) only draws the poster and posts it.

-- ── Times of the automatic product posters ──────────────────────────────────────────────────────────────────────────────────────────────
-- A comma-separated list of HH:MM (Haiti time): one poster per time, so the number of posters a day is the number of times.
-- The default spreads 5 posters over the day (they used to be posted one after the other from 7:00).
INSERT INTO public.app_settings (key, value, label, description, sensitive) VALUES
  ('auto_post_times', '07:00,10:00,13:00,16:00,19:00', 'Heures de la publication automatique', 'Heures (Haïti) des affiches de produits : une affiche par heure, de 1 à 12 par jour.', true)
ON CONFLICT (key) DO NOTHING;

-- The valid times of the setting, sorted and without duplicates (at most 12): whatever was typed by hand in the settings table, the job stays safe.
CREATE OR REPLACE FUNCTION public.autopost_slots()
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(t ORDER BY t), '{}'::text[]) FROM (
    SELECT DISTINCT btrim(x) AS t
      FROM unnest(string_to_array(coalesce((SELECT value FROM app_settings WHERE key = 'auto_post_times'), ''), ',')) AS x
     WHERE btrim(x) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     ORDER BY 1 LIMIT 12
  ) s
$$;
REVOKE ALL ON FUNCTION public.autopost_slots() FROM PUBLIC, anon, authenticated;

-- The admin's schedule form: validated here (the screen's checks are only a comfort).
CREATE OR REPLACE FUNCTION public.admin_set_autopost_schedule(p_times text[])
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clean text[];
  v_value text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_times IS NULL OR cardinality(p_times) = 0 THEN RAISE EXCEPTION 'Choisissez au moins une heure de publication.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_times) t WHERE btrim(t) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') THEN
    RAISE EXCEPTION 'Heure invalide : utilisez le format HH:MM (de 00:00 à 23:59).';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO v_clean FROM (SELECT DISTINCT btrim(x) AS t FROM unnest(p_times) x) s;
  IF cardinality(v_clean) > 12 THEN RAISE EXCEPTION '12 publications par jour au maximum.'; END IF;
  v_value := array_to_string(v_clean, ',');
  UPDATE app_settings SET value = v_value, updated_at = now() WHERE key = 'auto_post_times';
  RETURN v_value;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_autopost_schedule(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_autopost_schedule(text[]) TO authenticated;

-- The dispatcher now follows the times: a poster is due for every time already passed today, and one is posted per tick until the day is caught up.
-- p_force = true (the admin's "post now" button) skips the switch and the times, but never the "one poster per product" rule.
CREATE OR REPLACE FUNCTION public.autopost_dispatch(p_force boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_local      timestamp := now() AT TIME ZONE 'America/Port-au-Prince';
  v_day        date := (now() AT TIME ZONE 'America/Port-au-Prince')::date;
  v_slots      text[] := public.autopost_slots();
  v_due        integer := 0;
  v_secret     text;
  v_product    uuid;
  v_row        uuid;
BEGIN
  IF NOT p_force THEN
    IF coalesce((SELECT value FROM app_settings WHERE key = 'auto_post_enabled'), 'false') <> 'true' THEN RETURN 'disabled'; END IF;
    SELECT count(*) INTO v_due FROM unnest(v_slots) s WHERE s::time <= v_local::time;
    IF v_due = 0 THEN RETURN 'too_early'; END IF;
  END IF;

  -- an attempt that never got an answer (function stopped) does not block the next ones
  UPDATE social_posts SET status = 'failed', error = coalesce(error, 'La publication n''a pas répondu à temps.'), updated_at = now()
   WHERE source = 'auto' AND status = 'pending' AND updated_at < now() - interval '15 minutes';
  IF EXISTS (SELECT 1 FROM social_posts WHERE source = 'auto' AND status = 'pending') THEN RETURN 'busy'; END IF;

  IF NOT p_force THEN
    IF (SELECT count(*) FROM social_posts WHERE source = 'auto' AND local_day = v_day) >= v_due THEN RETURN 'done_today'; END IF;
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

-- ── The editorial calendar ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
-- One row per poster that is not a product: an event, an explainer, a piece of news or a promo. The site proposes them (status 'proposed'),
-- the admin edits and validates them ('approved'), the job below publishes the approved ones when their time has come.
CREATE TABLE IF NOT EXISTS public.social_calendar (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind               text NOT NULL CHECK (kind IN ('event', 'explainer', 'news', 'promo')),
  -- the poster layout: a stock photo under a dark gradient, or a product photo on a light background
  layout             text NOT NULL DEFAULT 'photo' CHECK (layout IN ('photo', 'studio')),
  -- the id of the stock photo (public/social-assets/<id>.jpg); null draws a plain gradient
  asset              text CHECK (asset IS NULL OR asset ~ '^[a-z0-9-]{1,60}$'),
  badge              text CHECK (char_length(badge) <= 40),
  headline           text NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 3 AND 120),
  subline            text CHECK (char_length(subline) <= 200),
  bullets            text[] NOT NULL DEFAULT '{}' CHECK (cardinality(bullets) <= 4 AND char_length(array_to_string(bullets, '')) <= 360),
  caption            text NOT NULL CHECK (char_length(btrim(caption)) BETWEEN 3 AND 2000),
  targets            text[] NOT NULL DEFAULT '{facebook,instagram}' CHECK (cardinality(targets) BETWEEN 1 AND 2 AND targets <@ ARRAY['facebook', 'instagram']),
  scheduled_at       timestamptz NOT NULL,
  status             text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected', 'posting', 'posted', 'failed')),
  facebook_post_id   text,
  instagram_media_id text,
  error              text,
  attempts           integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  /** The proposal run that created it (e.g. '2026-11 · 3 mois'), to find and reject a whole run. */
  batch              text CHECK (char_length(batch) <= 80),
  created_by         uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_calendar_due_idx ON public.social_calendar (status, scheduled_at);

ALTER TABLE public.social_calendar ENABLE ROW LEVEL SECURITY;
-- The team reads and edits the calendar; the browser can only move a poster between proposed / approved / rejected (and delete a poster that is not
-- being published or already published). 'posting', 'posted' and 'failed' are written by the job and the Edge Function only.
DROP POLICY IF EXISTS social_calendar_admin_read ON public.social_calendar;
CREATE POLICY social_calendar_admin_read ON public.social_calendar FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS social_calendar_admin_insert ON public.social_calendar;
CREATE POLICY social_calendar_admin_insert ON public.social_calendar FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND status IN ('proposed', 'approved') AND facebook_post_id IS NULL AND instagram_media_id IS NULL AND attempts = 0 AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS social_calendar_admin_update ON public.social_calendar;
CREATE POLICY social_calendar_admin_update ON public.social_calendar FOR UPDATE TO authenticated
  USING (public.is_admin() AND status IN ('proposed', 'approved', 'rejected', 'failed'))
  WITH CHECK (public.is_admin() AND status IN ('proposed', 'approved', 'rejected'));
DROP POLICY IF EXISTS social_calendar_admin_delete ON public.social_calendar;
CREATE POLICY social_calendar_admin_delete ON public.social_calendar FOR DELETE TO authenticated
  USING (public.is_admin() AND status IN ('proposed', 'approved', 'rejected', 'failed'));

CREATE OR REPLACE FUNCTION public.social_calendar_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.social_calendar_touch() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS social_calendar_touch ON public.social_calendar;
CREATE TRIGGER social_calendar_touch BEFORE UPDATE ON public.social_calendar FOR EACH ROW EXECUTE FUNCTION public.social_calendar_touch();

-- Asks the Edge Function to draw and post one calendar row (already marked 'posting' by the caller).
CREATE OR REPLACE FUNCTION public.social_calendar_send(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT value INTO v_secret FROM app_settings WHERE key = 'auto_post_secret';
  IF v_secret IS NULL THEN RAISE EXCEPTION 'no_secret'; END IF;
  PERFORM net.http_post(
    url => 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/facebook-post',
    headers => jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body => jsonb_build_object('action', 'calendar_post', 'id', p_id),
    timeout_milliseconds => 150000
  );
END;
$$;
REVOKE ALL ON FUNCTION public.social_calendar_send(uuid) FROM PUBLIC, anon, authenticated;

-- The job: every 10 minutes it publishes the approved posters whose time has come (two at most per run, the oldest first).
-- A poster that waited more than a day (the job was stopped) is not published: an outdated event or news would look wrong.
CREATE OR REPLACE FUNCTION public.social_calendar_tick()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  UPDATE social_calendar SET status = 'failed', error = coalesce(error, 'La publication n''a pas répondu à temps.'), updated_at = now()
   WHERE status = 'posting' AND updated_at < now() - interval '15 minutes';
  UPDATE social_calendar SET status = 'failed', error = 'Date dépassée : l''affiche n''a pas été publiée à temps.', updated_at = now()
   WHERE status = 'approved' AND scheduled_at < now() - interval '1 day';

  FOR r IN
    WITH due AS (
      SELECT id FROM social_calendar WHERE status = 'approved' AND scheduled_at <= now() ORDER BY scheduled_at LIMIT 2 FOR UPDATE SKIP LOCKED
    )
    UPDATE social_calendar c SET status = 'posting', attempts = c.attempts + 1, error = NULL, updated_at = now()
      FROM due WHERE c.id = due.id RETURNING c.id
  LOOP
    PERFORM public.social_calendar_send(r.id);
    n := n + 1;
  END LOOP;
  RETURN n::text;
END;
$$;
REVOKE ALL ON FUNCTION public.social_calendar_tick() FROM PUBLIC, anon, authenticated;

-- The admin's "publish now" (also the retry of a failed poster): the poster goes out right away.
CREATE OR REPLACE FUNCTION public.admin_social_publish_now(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE social_calendar SET status = 'posting', attempts = attempts + 1, error = NULL, scheduled_at = now(), updated_at = now()
   WHERE id = p_id AND status IN ('proposed', 'approved', 'rejected', 'failed')
   RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN 'unavailable'; END IF;
  PERFORM public.social_calendar_send(v_id);
  RETURN 'sent';
END;
$$;
REVOKE ALL ON FUNCTION public.admin_social_publish_now(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_social_publish_now(uuid) TO authenticated;

SELECT cron.schedule('konvwa-social-calendar', '*/10 * * * *', 'SELECT public.social_calendar_tick()');
