-- Rates used to read prices found on shop pages (the customer can always correct the price)
INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('cny_to_usd_rate', '0.14', 'Taux CNY → USD', 'Conversion des prix en yuan trouvés sur les liens importés.', false),
  ('eur_to_usd_rate', '1.08', 'Taux EUR → USD', 'Conversion des prix en euro trouvés sur les liens importés.', false)
ON CONFLICT (key) DO NOTHING;
