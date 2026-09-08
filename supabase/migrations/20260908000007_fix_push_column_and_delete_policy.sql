-- Fix notify_push_on_insert: was referencing NEW.body but the column is NEW.message.
-- This caused the EXCEPTION handler to swallow the error silently, sending no push.
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
      'body',      NEW.message,
      'icon',      '/icon-192.png',
      'type',      COALESCE(NEW.type, 'info'),
      'click_url', '/notifications'
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let push errors roll back the notification insert
  RETURN NEW;
END;
$$;

-- Allow users to delete their own notifications (needed for the trash icon in the UI)
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  USING (auth.uid() = user_id);
