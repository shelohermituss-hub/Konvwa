-- Complete user management: account status (active / suspended / banned), per-action restrictions enforced by the database,
-- internal notes (never visible to the customer) and staff RPCs. The browser never writes these columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text,
  ADD COLUMN IF NOT EXISTS status_until timestamptz,
  ADD COLUMN IF NOT EXISTS restrictions text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check CHECK (account_status IN ('active', 'suspended', 'banned')),
  ADD CONSTRAINT profiles_restrictions_check CHECK (restrictions <@ ARRAY['orders', 'payments', 'deposits', 'requests', 'support']::text[]),
  ADD CONSTRAINT profiles_status_reason_check CHECK (status_reason IS NULL OR length(status_reason) <= 300);

-- internal notes: staff only (the profile row is readable by its owner, so notes live in their own table)
CREATE TABLE IF NOT EXISTS public.user_admin_notes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage user notes" ON public.user_admin_notes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- only the staff functions below change status / restrictions
CREATE OR REPLACE FUNCTION public.guard_profile_access()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.account_status := OLD.account_status; NEW.status_reason := OLD.status_reason;
      NEW.status_until := OLD.status_until; NEW.restrictions := OLD.restrictions;
    ELSE
      NEW.account_status := 'active'; NEW.status_reason := NULL; NEW.status_until := NULL; NEW.restrictions := '{}';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_profile_access() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_profile_access BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_access();

-- may the signed-in customer do this? (active account, action not restricted; a suspended account can still write to support)
CREATE OR REPLACE FUNCTION public.user_can(p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN p.role <> 'client' THEN true
      WHEN p.account_status = 'banned' THEN false
      WHEN p.account_status = 'suspended' AND (p.status_until IS NULL OR p.status_until > now()) THEN p_action = 'support' AND NOT ('support' = ANY (p.restrictions))
      ELSE NOT (p_action = ANY (p.restrictions))
    END
    FROM profiles p WHERE p.user_id = (SELECT auth.uid())
  ), true);
$$;
REVOKE EXECUTE ON FUNCTION public.user_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can(text) TO authenticated;

-- enforcement inside the money / order functions
DO $$
DECLARE
  item record; def text; pos integer;
  guard text;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('public.create_product_order(jsonb,text)', 'orders'),
    ('public.accept_quote(uuid)', 'orders'),
    ('public.request_shipping_quote(text,uuid,text,integer,numeric,numeric)', 'requests'),
    ('public.request_shipping_quote(text,uuid,text,integer,numeric,numeric,text,text)', 'requests'),
    ('public.pay_order(uuid)', 'payments'),
    ('public.pay_product_order(uuid)', 'payments'),
    ('public.pay_order_shipping(text,uuid,uuid)', 'payments'),
    ('public.pay_shipping_quote(uuid,text)', 'payments'),
    ('public.pay_shipping_balance(uuid)', 'payments'),
    ('public.pay_next_installment(uuid)', 'payments'),
    ('public.start_installments(uuid,integer)', 'payments'),
    ('public.buy_shipping_insurance(uuid,numeric)', 'payments')
  ) AS t(sig, action) LOOP
    def := pg_get_functiondef(item.sig::regprocedure);
    CONTINUE WHEN position('user_can(' in def) > 0;
    pos := position(E'\nBEGIN\n' in def);
    IF pos = 0 THEN RAISE EXCEPTION 'no BEGIN in %', item.sig; END IF;
    guard := '  IF NOT public.user_can(''' || item.action || ''') THEN RETURN jsonb_build_object(''success'', false, ''error'', ''Cette action est restreinte sur votre compte. Contactez le support.''); END IF;' || E'\n';
    EXECUTE substr(def, 1, pos + 6) || guard || substr(def, pos + 7);
  END LOOP;
END $$;

-- direct inserts by the customer (requests, support, pending deposits)
-- (not SECURITY DEFINER: the guard tests current_user, the role of the caller)
CREATE OR REPLACE FUNCTION public.guard_user_action()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_action text := TG_ARGV[0];
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_admin() THEN
    IF TG_TABLE_NAME = 'wallet_transactions' THEN
      IF NEW.type <> 'deposit' THEN RETURN NEW; END IF;
    END IF;
    IF NOT user_can(v_action) THEN
      RAISE EXCEPTION 'Cette action est restreinte sur votre compte. Contactez le support.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_user_action() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_action_requests BEFORE INSERT ON public.product_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_action('requests');
CREATE TRIGGER trg_guard_action_tickets BEFORE INSERT ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_action('support');
CREATE TRIGGER trg_guard_action_deposits BEFORE INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_action('deposits');

-- staff: set status and restrictions of a customer (admins also manage agents / managers, never other admins or themselves)
CREATE OR REPLACE FUNCTION public.admin_set_user_access(
  p_user uuid, p_status text, p_reason text DEFAULT NULL, p_until timestamptz DEFAULT NULL, p_restrictions text[] DEFAULT '{}')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t profiles%ROWTYPE; v_caller_admin boolean := (SELECT role = 'admin' FROM profiles WHERE user_id = auth.uid());
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF p_user = auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas modifier votre propre accès.'); END IF;
  IF p_status NOT IN ('active', 'suspended', 'banned') THEN RETURN jsonb_build_object('success', false, 'error', 'Statut invalide.'); END IF;
  IF NOT (coalesce(p_restrictions, '{}') <@ ARRAY['orders', 'payments', 'deposits', 'requests', 'support']::text[]) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Restriction invalide.');
  END IF;
  IF p_status <> 'active' AND v_reason IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif de la suspension.');
  END IF;
  IF p_until IS NOT NULL AND p_until <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'La date de fin doit être dans le futur.');
  END IF;
  SELECT * INTO t FROM profiles WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Utilisateur introuvable.'); END IF;
  IF t.role = 'admin' OR (t.role <> 'client' AND NOT v_caller_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Vous ne pouvez pas modifier l''accès de ce compte.');
  END IF;

  UPDATE profiles SET account_status = p_status,
         status_reason = CASE WHEN p_status = 'active' THEN NULL ELSE left(v_reason, 300) END,
         status_until = CASE WHEN p_status = 'suspended' THEN p_until ELSE NULL END,
         restrictions = coalesce(p_restrictions, '{}'), updated_at = now()
   WHERE user_id = p_user;

  IF p_status IS DISTINCT FROM t.account_status OR coalesce(p_restrictions, '{}') IS DISTINCT FROM t.restrictions THEN
    INSERT INTO notifications (user_id, title, body, title_en, body_en, type, link)
    VALUES (p_user,
      CASE p_status WHEN 'active' THEN 'Accès à votre compte' WHEN 'suspended' THEN 'Compte suspendu' ELSE 'Compte désactivé' END,
      CASE p_status WHEN 'active' THEN CASE WHEN cardinality(coalesce(p_restrictions, '{}')) > 0 THEN 'Certaines actions de votre compte sont limitées. Contactez le support pour plus d''informations.' ELSE 'Votre compte est de nouveau pleinement accessible.' END
                    ELSE 'Motif : ' || v_reason END,
      CASE p_status WHEN 'active' THEN 'Account access' WHEN 'suspended' THEN 'Account suspended' ELSE 'Account deactivated' END,
      CASE p_status WHEN 'active' THEN CASE WHEN cardinality(coalesce(p_restrictions, '{}')) > 0 THEN 'Some actions on your account are limited. Contact support for more information.' ELSE 'Your account is fully accessible again.' END
                    ELSE 'Reason: ' || v_reason END,
      CASE p_status WHEN 'active' THEN 'info' ELSE 'error' END, '/support');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_access(uuid, text, text, timestamptz, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_access(uuid, text, text, timestamptz, text[]) TO authenticated;

-- staff: the user list with e-mail, status and key figures
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (user_id uuid, full_name text, phone text, email text, role text, created_at timestamptz, last_sign_in_at timestamptz,
               account_status text, status_until timestamptz, restrictions text[], order_count bigint, wallet_balance numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.user_id, p.full_name, p.phone, u.email::text, p.role, p.created_at, u.last_sign_in_at,
         p.account_status, p.status_until, p.restrictions,
         (SELECT count(*) FROM orders o WHERE o.user_id = p.user_id) + (SELECT count(*) FROM product_orders po WHERE po.user_id = p.user_id AND po.payment_status = 'paid'),
         coalesce((SELECT w.available_balance FROM wallets w WHERE w.user_id = p.user_id), 0)
    FROM profiles p LEFT JOIN auth.users u ON u.id = p.user_id
   ORDER BY p.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- staff: everything about one user
CREATE OR REPLACE FUNCTION public.admin_user_overview(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT is_admin() THEN RETURN '{}'::jsonb; END IF;
  SELECT jsonb_build_object(
    'profile', jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'phone', p.phone, 'role', p.role, 'created_at', p.created_at,
       'account_status', p.account_status, 'status_reason', p.status_reason, 'status_until', p.status_until, 'restrictions', p.restrictions,
       'is_reseller', p.is_reseller, 'language', p.language),
    'email', u.email, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at IS NOT NULL,
    'wallet_balance', coalesce((SELECT w.available_balance FROM wallets w WHERE w.user_id = p.user_id), 0),
    'kyc_status', (SELECT k.status FROM kyc_submissions k WHERE k.user_id = p.user_id),
    'counts', jsonb_build_object(
       'orders', (SELECT count(*) FROM orders o WHERE o.user_id = p.user_id),
       'catalog_orders', (SELECT count(*) FROM product_orders po WHERE po.user_id = p.user_id AND po.payment_status = 'paid'),
       'requests', (SELECT count(*) FROM product_requests pr WHERE pr.user_id = p.user_id),
       'open_tickets', (SELECT count(*) FROM support_tickets st WHERE st.user_id = p.user_id AND st.status IN ('open', 'in_progress'))),
    'total_spent', coalesce((SELECT sum(t.amount) FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id
                              WHERE w.user_id = p.user_id AND t.type = 'payment' AND t.status = 'completed'), 0),
    'recent_orders', coalesce((SELECT jsonb_agg(x) FROM (SELECT o.id, o.tracking_code AS code, o.status, o.total_paid AS amount, o.created_at, 'order' AS kind
                                 FROM orders o WHERE o.user_id = p.user_id ORDER BY o.created_at DESC LIMIT 5) x), '[]'::jsonb),
    'recent_catalog_orders', coalesce((SELECT jsonb_agg(x) FROM (SELECT po.id, po.tracking_code AS code, coalesce(po.tracking_status, po.status) AS status, po.total_htg AS amount, po.created_at, 'catalog' AS kind
                                 FROM product_orders po WHERE po.user_id = p.user_id AND po.payment_status = 'paid' ORDER BY po.created_at DESC LIMIT 5) x), '[]'::jsonb),
    'recent_transactions', coalesce((SELECT jsonb_agg(x) FROM (SELECT t.id, t.type, t.amount, t.status, t.description, t.created_at
                                 FROM wallet_transactions t JOIN wallets w ON w.id = t.wallet_id WHERE w.user_id = p.user_id ORDER BY t.created_at DESC LIMIT 8) x), '[]'::jsonb),
    'note', coalesce((SELECT n.note FROM user_admin_notes n WHERE n.user_id = p.user_id), '')
  ) INTO r
  FROM profiles p LEFT JOIN auth.users u ON u.id = p.user_id WHERE p.user_id = p_user;
  RETURN coalesce(r, '{}'::jsonb);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_user_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_overview(uuid) TO authenticated;
