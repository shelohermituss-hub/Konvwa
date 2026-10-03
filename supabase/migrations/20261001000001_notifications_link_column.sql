-- Add link column to notifications for deep-linking from push notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link text;

-- Update push trigger to use link as click_url (deep link to relevant page)
CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://aklwkbzkumcldumrmgmr.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbHdrYnprdW1jbGR1bXJtZ21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MTU5MzUsImV4cCI6MjA5ODA5MTkzNX0.SK9RM2GqKYtBSNhePDCJBILsrDsn30HnTm5nGce4d50'
    ),
    body := jsonb_build_object(
      'user_id',   NEW.user_id,
      'title',     NEW.title,
      'body',      NEW.body,
      'icon',      '/icon-192.png',
      'type',      COALESCE(NEW.type, 'info'),
      'click_url', COALESCE(NEW.link, '/notifications')
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
