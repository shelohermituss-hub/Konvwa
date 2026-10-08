-- Seed of 20261018000064: official tariffs of IBC Express and Petits Courriers (Miami → Haïti, May 2026). Run AFTER 20261018000064_carrier_rules.sql.
INSERT INTO public.shipping_item_types (slug, label, sort_order) VALUES
  ('phone','Téléphone',10),('smartwatch','Montre connectée',20),('earbuds','Écouteurs sans fil (AirPods, Galaxy Buds…)',30),('headphones','Casque audio',40),
  ('phone_screen','Écran de téléphone',50),('tablet','Tablette',60),('laptop','Ordinateur portable',70),('camera_pro','Caméra professionnelle',80),('drone','Drone',90),
  ('documents','Documents (enveloppe 9x12)',100),('perfume','Parfum',110),('alcohol','Alcool',120),('battery','Batterie',130),
  ('camera','Caméra',200),('surveillance_camera','Caméra de surveillance',210),('desktop','Ordinateur de bureau',220),('dvr','DVR',230),('game_console','Console de jeu',240),
  ('game_controller','Manette de jeu',250),('inverter','Onduleur',260),('inverter_regulator','Régulateur d''onduleur',270),('mini_perfume','Mini parfum',280),
  ('power_bank','Batterie externe (power bank)',290),('printer','Imprimante',300),('projector','Projecteur',310),('router','Routeur',320),
  ('screen_monitor','Écran d''ordinateur',330),('smart_tv','Smart TV 32" et plus',340),('starlink','Starlink',350)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE ibc_air uuid; ibc_sea uuid; pap uuid; cap uuid; t text; i integer;
  tiers_min numeric[] := ARRAY[0, 300.01, 700.01, 1000.01];
  tiers_max numeric[] := ARRAY[300, 700, 1000, 2000];
  ph_pap numeric[] := ARRAY[25, 30, 45, 65];  ph_cap numeric[] := ARRAY[20, 25, 40, 60];
  lp_pap numeric[] := ARRAY[45, 55, 70, 90];  lp_cap numeric[] := ARRAY[40, 50, 65, 85];
BEGIN
  SELECT id INTO ibc_air FROM shipping_rates WHERE name = 'IBC EXPRESS SHIPPING - AIR';
  SELECT id INTO ibc_sea FROM shipping_rates WHERE name = 'IBC express shipping - Bateau';
  SELECT id INTO pap FROM shipping_rates WHERE name IN ('Petit courrier - Air', 'Petits Courriers - Port-au-Prince') ORDER BY created_at LIMIT 1;

  -- IBC Express: volumetric weight / 132 (air), fixed prices per item, special per-pound prices
  IF ibc_air IS NOT NULL THEN UPDATE shipping_rates SET volumetric_divisor = 132 WHERE id = ibc_air; END IF;
  FOR t IN SELECT unnest(ARRAY[ibc_air, ibc_sea]::text[]) LOOP
    IF t IS NULL THEN CONTINUE; END IF;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES
      (t::uuid,'smartwatch','fixed',10),(t::uuid,'headphones','fixed',10),(t::uuid,'phone_screen','fixed',10),
      (t::uuid,'documents','fixed',25),
      (t::uuid,'phone','fixed',35),(t::uuid,'tablet','fixed',35),(t::uuid,'camera_pro','fixed',35),(t::uuid,'drone','fixed',35),
      (t::uuid,'laptop','fixed',55),
      (t::uuid,'perfume','extra',4),(t::uuid,'alcohol','per_lb',4),(t::uuid,'battery','per_lb',5)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Petits Courriers: Port-au-Prince (existing rate) and Cap-Haïtien (new), 3.95 / 3.40 per lb, volumetric / 132, small parcel flat price
  IF pap IS NOT NULL THEN
    UPDATE shipping_rates SET name = 'Petits Courriers - Port-au-Prince', volumetric_divisor = 132, flat_max_lb = 5, flat_max_value_usd = 200, flat_price_usd = 25,
           min_amount_usd = 0, per_kg_usd = 8.7082, transit_days_min = 10, transit_days_max = 14 WHERE id = pap;
    SELECT id INTO cap FROM shipping_rates WHERE name = 'Petits Courriers - Cap-Haïtien';
    IF cap IS NULL THEN
      INSERT INTO shipping_rates (mode, name, type_label, priority, origin_id, min_amount_usd, base_fee_usd, per_kg_usd, transit_days_min, transit_days_max, description,
                                  active, sort_order, carrier_logo_url, general_fee_usd, volumetric_divisor, flat_max_lb, flat_max_value_usd, flat_price_usd)
        SELECT mode, 'Petits Courriers - Cap-Haïtien', type_label, priority, origin_id, 0, base_fee_usd, 7.4957, 5, 7, description,
               active, sort_order + 1, carrier_logo_url, general_fee_usd, 132, 5, 200, 18 FROM shipping_rates WHERE id = pap
        RETURNING id INTO cap;
    END IF;
    FOR i IN 1..4 LOOP
      FOREACH t IN ARRAY ARRAY['phone','smartwatch','earbuds'] LOOP
        INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd, value_min_usd, value_max_usd) VALUES
          (pap, t, 'fixed', ph_pap[i], tiers_min[i], tiers_max[i]), (cap, t, 'fixed', ph_cap[i], tiers_min[i], tiers_max[i]) ON CONFLICT DO NOTHING;
      END LOOP;
      FOREACH t IN ARRAY ARRAY['laptop','tablet'] LOOP
        INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd, value_min_usd, value_max_usd) VALUES
          (pap, t, 'fixed', lp_pap[i], tiers_min[i], tiers_max[i]), (cap, t, 'fixed', lp_cap[i], tiers_min[i], tiers_max[i]) ON CONFLICT DO NOTHING;
      END LOOP;
    END LOOP;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap,'documents','fixed',35),(cap,'documents','fixed',30) ON CONFLICT DO NOTHING;
    FOR t, i IN SELECT * FROM (VALUES ('camera',10),('surveillance_camera',5),('desktop',15),('dvr',10),('game_console',10),('game_controller',5),('inverter',20),
        ('inverter_regulator',5),('power_bank',5),('printer',10),('projector',10),('router',2),('screen_monitor',10),('smart_tv',25),('starlink',50)) v(a, b) LOOP
      INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap, t, 'extra', i), (cap, t, 'extra', i) ON CONFLICT DO NOTHING;
    END LOOP;
    INSERT INTO shipping_item_rules (rate_id, item_type, mode, price_usd) VALUES (pap,'mini_perfume','extra',1.5),(cap,'mini_perfume','extra',1.5),(pap,'perfume','extra',3),(cap,'perfume','extra',3) ON CONFLICT DO NOTHING;
  END IF;
END
$$;
