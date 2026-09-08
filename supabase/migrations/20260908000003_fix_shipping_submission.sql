-- Fix shipping request submission errors

-- 1. Make product_url nullable (shipping requests have no URL)
ALTER TABLE product_requests ALTER COLUMN product_url DROP NOT NULL;
ALTER TABLE product_requests ALTER COLUMN product_url SET DEFAULT '';

-- 2. Extend status constraint to include 'accepted' and 'completed'
ALTER TABLE product_requests DROP CONSTRAINT IF EXISTS product_requests_status_check;
ALTER TABLE product_requests ADD CONSTRAINT product_requests_status_check
  CHECK (status IN ('draft', 'submitted', 'reviewing', 'quoted', 'accepted', 'rejected', 'completed'));

-- 3. Fix push trigger column reference (body vs message)
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbHdrYnprdW1jbGR1bXJtZ21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTU5MzUsImV4cCI6MjA5ODA5MTkzNX0.SK9RM2GqKYtBSNhePDCJBILsrDsn30HnTm5nGce4d50'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   NEW.title,
      'body',    NEW.body,
      'type',    NEW.type,
      'click_url', '/notifications'
    )
  );
  RETURN NEW;
END;
$$;

-- 4. Seed freight rate settings
INSERT INTO app_settings (key, value, label, description)
VALUES
  ('freight_ocean_per_cbm_usd', '200', 'Fret maritime (USD/CBM)', 'Coût du transport maritime par mètre cube'),
  ('freight_air_per_kg_usd',    '11',  'Fret aérien (USD/kg)',    'Coût du transport aérien par kilogramme')
ON CONFLICT (key) DO NOTHING;
