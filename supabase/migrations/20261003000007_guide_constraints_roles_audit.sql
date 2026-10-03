-- SQL safety nets (the database refuses what the UI should never send)
ALTER TABLE wallets ADD CONSTRAINT wallets_balances_nonnegative CHECK (available_balance >= 0 AND blocked_balance >= 0);
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_amount_positive CHECK (amount > 0);

-- Only an administrator (not a manager) may change roles
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin');
$$;
REVOKE ALL ON FUNCTION is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION guard_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND NOT is_super_admin() THEN
    IF TG_OP = 'UPDATE' THEN
      NEW.role := OLD.role;
    ELSE
      NEW.role := 'client';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Append-only audit trail: readable by admins, writable only by the triggers below
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid,
  actor_role    text,
  action        text NOT NULL,
  resource_type text NOT NULL,
  resource_id   text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_admin_read ON audit_logs FOR SELECT TO authenticated USING (is_admin());
REVOKE ALL ON TABLE audit_logs FROM anon, authenticated;
GRANT SELECT ON TABLE audit_logs TO authenticated;

CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cols    text[];
  v_col     text;
  v_old     jsonb := to_jsonb(OLD);
  v_new     jsonb := to_jsonb(NEW);
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;  -- system jobs are not human actions

  v_cols := CASE TG_TABLE_NAME
    WHEN 'profiles'            THEN ARRAY['role']
    WHEN 'wallets'             THEN ARRAY['available_balance', 'blocked_balance']
    WHEN 'wallet_transactions' THEN ARRAY['status']
    WHEN 'orders'              THEN ARRAY['status', 'payment_status']
    WHEN 'product_requests'    THEN ARRAY['status', 'shipment_id', 'paid_amount_htg', 'quoted_amount_htg']
    WHEN 'shipments'           THEN ARRAY['status']
    ELSE ARRAY[]::text[]
  END;

  FOREACH v_col IN ARRAY v_cols LOOP
    IF v_old->>v_col IS DISTINCT FROM v_new->>v_col THEN
      v_details := v_details || jsonb_build_object(v_col, jsonb_build_object('from', v_old->>v_col, 'to', v_new->>v_col));
    END IF;
  END LOOP;

  IF v_details = '{}'::jsonb THEN RETURN NEW; END IF;

  INSERT INTO audit_logs (actor_id, actor_role, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    (SELECT role FROM profiles WHERE user_id = auth.uid()),
    TG_TABLE_NAME || '.update',
    TG_TABLE_NAME,
    coalesce(v_new->>'id', v_new->>'user_id'),
    v_details || jsonb_build_object('owner_user_id', v_new->>'user_id')
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION audit_row_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_audit_profiles AFTER UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER trg_audit_wallets AFTER UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER trg_audit_wallet_transactions AFTER UPDATE ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER trg_audit_orders AFTER UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER trg_audit_product_requests AFTER UPDATE ON product_requests FOR EACH ROW EXECUTE FUNCTION audit_row_change();
CREATE TRIGGER trg_audit_shipments AFTER UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- Admin policies go through the security-definer helper instead of repeating a subquery on profiles
ALTER POLICY admin_write_settings ON app_settings USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY admin_read_all_settings ON app_settings USING (sensitive = true AND is_admin());
ALTER POLICY "Admins can insert any notification" ON notifications WITH CHECK (is_admin());
ALTER POLICY "Admins can read all notifications" ON notifications USING (is_admin());
ALTER POLICY "Admins can update any notification" ON notifications USING (is_admin());
ALTER POLICY poi_admin_all ON product_order_items USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY product_orders_admin_all ON product_orders USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY admin_all_categories ON product_rate_categories USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY products_admin_all ON products USING (is_admin()) WITH CHECK (is_admin());
ALTER POLICY admin_all_warehouses ON warehouses USING (is_admin()) WITH CHECK (is_admin());
