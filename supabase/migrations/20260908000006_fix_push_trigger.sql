-- Fix notify_push_on_notification: previous version relied on
-- current_setting('app.supabase_url') which is NULL on Supabase hosted projects,
-- causing the trigger to silently return without ever calling the Edge Function.
-- Hardcode the project URL and anon key (anon key is already public in the frontend).

CREATE OR REPLACE FUNCTION notify_push_on_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     => 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/send-push',
    headers => jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbHdrYnprdW1jbGR1bXJtZ21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTU5MzUsImV4cCI6MjA5ODA5MTkzNX0.SK9RM2GqKYtBSNhePDCJBILsrDsn30HnTm5nGce4d50'
    ),
    body    => jsonb_build_object(
      'user_id',   NEW.user_id,
      'title',     NEW.title,
      'body',      NEW.message,
      'icon',      '/icon-192.png',
      'click_url', '/notifications',
      'type',      COALESCE(NEW.type, 'info')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the notification insert if push delivery fails
  RETURN NEW;
END;
$$;

-- Also name the unique constraint on push_subscriptions so PostgREST
-- upsert can target it reliably.
ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_subscription_endpoint_key;

-- Re-add as a named constraint so onConflict works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_endpoint_unique'
  ) THEN
    ALTER TABLE push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_endpoint_unique
      UNIQUE (user_id, (subscription->>'endpoint'));
  END IF;
END;
$$;
