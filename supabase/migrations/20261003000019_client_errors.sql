-- Lightweight error monitoring: the app reports uncaught errors, grouped per day and fingerprint
CREATE TABLE IF NOT EXISTS public.client_errors (
  fingerprint text        NOT NULL,
  day         date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  message     text        NOT NULL,
  stack       text,
  url         text,
  user_agent  text,
  occurrences integer     NOT NULL DEFAULT 1,
  first_at    timestamptz NOT NULL DEFAULT now(),
  last_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fingerprint, day)
);
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_errors_admin_select ON public.client_errors FOR SELECT TO authenticated USING (is_admin());
-- no write policy: the function below is the only way in

CREATE OR REPLACE FUNCTION public.log_client_error(p_message text, p_stack text, p_url text, p_user_agent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message text := left(coalesce(p_message, 'unknown'), 500);
  v_fp      text := md5(left(coalesce(p_message, ''), 300) || '|' || left(split_part(coalesce(p_stack, ''), E'\n', 2), 200));
BEGIN
  -- the endpoint is open (errors can happen before sign-in): cap the total volume
  IF NOT public.check_rate_limit('client-errors', 120, 60) THEN RETURN; END IF;

  INSERT INTO client_errors (fingerprint, message, stack, url, user_agent)
  VALUES (v_fp, v_message, left(p_stack, 4000), left(p_url, 300), left(p_user_agent, 300))
  ON CONFLICT (fingerprint, day) DO UPDATE
    SET occurrences = client_errors.occurrences + 1, last_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_client_error(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error(text, text, text, text) TO anon, authenticated;
