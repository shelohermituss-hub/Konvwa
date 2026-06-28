-- Payment integration migration
-- Adds payment settings, sensitive flag, and plop_transaction_id column

-- 1. Add sensitive flag to app_settings
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS sensitive BOOLEAN NOT NULL DEFAULT false;

-- 2. Update read policy: sensitive rows are admin-only
DROP POLICY IF EXISTS "authenticated_read_settings" ON app_settings;

CREATE POLICY "read_public_settings" ON app_settings
  FOR SELECT TO authenticated
  USING (sensitive = false);

CREATE POLICY "admin_read_all_settings" ON app_settings
  FOR SELECT TO authenticated
  USING (
    sensitive = true AND
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- 3. Insert payment settings (public ones)
INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('payment_client_id',   '', 'Client ID PLOP PLOP',   'Identifiant marchand fourni par PLOP PLOP (format: pp_...)', false),
  ('payment_return_url',  '', 'URL de retour paiement', 'URL vers laquelle PLOP PLOP redirige après paiement (ex: https://monsite.com/payment/return)', false),
  ('payment_methods',     'moncash,natcash', 'Méthodes actives', 'Méthodes de paiement activées (moncash, natcash, ou moncash,natcash)', false),
  ('payment_base_url',    'https://plopplop.solutionip.app', 'URL de base PLOP PLOP', 'URL de base de l''API PLOP PLOP', false)
ON CONFLICT (key) DO NOTHING;

-- 4. Insert sensitive payment secret
INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('payment_client_secret', '', 'Clé Privée (Hash 64 chars)', 'Clé secrète HMAC fournie par PLOP PLOP — ne jamais partager', true)
ON CONFLICT (key) DO NOTHING;

-- 5. Add plop_transaction_id to wallet_transactions for reconciliation
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS plop_transaction_id TEXT;

-- 6. Add index for reference lookups (used in verify flow)
CREATE INDEX IF NOT EXISTS wallet_transactions_reference_idx ON wallet_transactions(reference);
