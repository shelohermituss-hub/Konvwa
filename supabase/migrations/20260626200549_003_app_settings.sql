
-- Add calculation fields to product_requests
ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS unit_price_usd NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS estimated_total_htg NUMERIC(12,2);

-- App settings table for admin-configurable parameters
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_settings" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admin_write_settings" ON app_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

INSERT INTO app_settings (key, value, label, description) VALUES
  ('usd_to_htg_rate', '132', 'Taux USD → HTG', 'Taux de change utilisé pour estimer les coûts'),
  ('freight_per_kg_usd', '11', 'Fret aérien (USD/kg)', 'Coût du transport aérien par kilogramme'),
  ('duty_rate_percent', '20', 'Droits de douane (%)', 'Taux de droits appliqué sur la valeur CIF'),
  ('service_margin_percent', '15', 'Marge de service (%)', 'Commission du service appliquée au total')
ON CONFLICT (key) DO NOTHING;
