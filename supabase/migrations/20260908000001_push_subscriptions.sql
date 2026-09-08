-- Push subscriptions for Web Push API (VAPID)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription       jsonb       NOT NULL,
  user_agent         text,
  notification_types text[]      DEFAULT ARRAY['orders', 'payments', 'quotes', 'alerts'],
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (user_id, (subscription->>'endpoint'))
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow Edge Function (service role) to read all subscriptions
CREATE POLICY "Service role full access"
  ON push_subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_push_subscription_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_push_subscription_ts
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_push_subscription_ts();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: when a notification is inserted, call send-push Edge Function
-- Requires pg_net extension: run `CREATE EXTENSION IF NOT EXISTS pg_net;` in SQL editor
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_push_on_notification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _url  text;
  _key  text;
BEGIN
  -- These must be set as Supabase secrets (vault) or env vars
  _url := current_setting('app.supabase_url', true) || '/functions/v1/send-push';
  _key := current_setting('app.service_role_key', true);

  IF _url IS NULL OR _key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     => _url,
    headers => jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || _key
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
END;
$$;

CREATE TRIGGER trg_send_push_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_push_on_notification();
