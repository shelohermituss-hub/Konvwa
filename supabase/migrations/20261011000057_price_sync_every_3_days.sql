-- Muscle & Strength prices are read once every 3 days (not every day). 70 h rather than 72: the job runs every day 07:00-09:30 UTC,
-- so a product checked in one window is due again in the window 3 days later.
CREATE OR REPLACE FUNCTION public.run_price_sync()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM products WHERE price_sync AND active AND source_url IS NOT NULL AND (price_checked_at IS NULL OR price_checked_at < now() - interval '70 hours')) THEN RETURN; END IF;
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
