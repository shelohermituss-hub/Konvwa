-- Shipping is priced by WEIGHT only: the CBM price is gone. The parcel is charged at the greater of its real weight and its volumetric weight,
-- the volumetric formula being chosen per rate: inches (L x W x H / 132, result in lb), cm (L x W x H / 2000, result in kg; corrected by migration 67),
-- standard (cm3 / 6000 = kg, the platform default) or none (real weight only). The price is that weight x the price per kg x the category coefficient.
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS volumetric_unit text;
ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_volumetric_unit;
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_volumetric_unit CHECK (volumetric_unit IS NULL OR volumetric_unit IN ('in', 'cm', 'none'));
-- rates already carrying a divisor (IBC, Petits Courriers: 132) were inches
UPDATE public.shipping_rates SET volumetric_unit = 'in' WHERE volumetric_divisor IS NOT NULL AND volumetric_unit IS NULL;
-- IBC sea freight: real weight only (IBC applies the volumetric weight to air)
UPDATE public.shipping_rates SET volumetric_unit = 'none', volumetric_divisor = NULL WHERE name = 'IBC express shipping - Bateau';

-- Weight (kg) a parcel is charged for under a rate's volumetric formula; p_cbm is the volume in m3.
CREATE OR REPLACE FUNCTION public.billed_weight_kg(p_divisor numeric, p_unit text, p_kg numeric, p_cbm numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_unit = 'none' THEN coalesce(p_kg, 0)
    WHEN p_divisor > 0 AND p_unit = 'cm' THEN greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 1000000 / p_divisor / 2.2046226)
    WHEN p_divisor > 0 THEN greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 1000000 / 16.387064 / p_divisor / 2.2046226)
    ELSE greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 166.6667)
  END;
$function$;
REVOKE EXECUTE ON FUNCTION public.billed_weight_kg(numeric, text, numeric, numeric) FROM PUBLIC, anon, authenticated;

-- single source of the shipping prices: charged weight x price per kg (no CBM price)
CREATE OR REPLACE FUNCTION public.shipping_options_for(p_kg numeric, p_cbm numeric, p_category uuid)
 RETURNS TABLE(rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140) AS usd,
           coalesce((SELECT rate_multiplier FROM product_rate_categories WHERE id = p_category), 1) AS mult
  )
  SELECT r.id, r.name, r.mode, r.transit_days_min::integer, r.transit_days_max::integer, r.description,
         round((greatest(coalesce(r.min_amount_usd, 0), coalesce(r.base_fee_usd, 0) + coalesce(r.per_kg_usd, 0) * w.billed)
                * (CASE WHEN upper(coalesce(so.country_code, 'CN')) = 'CN' THEN cfg.mult ELSE 1 END) + coalesce(r.general_fee_usd, 0)) * cfg.usd) AS amount_htg
    FROM shipping_rates r
    LEFT JOIN shipping_origins so ON so.id = r.origin_id
    CROSS JOIN cfg
    CROSS JOIN LATERAL (SELECT billed_weight_kg(r.volumetric_divisor, r.volumetric_unit, p_kg, p_cbm) AS billed) w
   WHERE r.active = true
     AND r.per_kg_usd IS NOT NULL
     AND w.billed > 0
     AND (r.max_weight_kg IS NULL OR w.billed <= r.max_weight_kg)
   ORDER BY r.sort_order, r.name;
$function$;

CREATE OR REPLACE FUNCTION public.cart_shipping_options(p_lines jsonb, p_cat uuid, p_country text)
 RETURNS TABLE(rate_id uuid, name text, mode text, transit_days_min integer, transit_days_max integer, description text, amount_htg numeric, billed_kg numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  usd numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'usd_to_htg_rate'), 140);
  r shipping_rates%ROWTYPE; l jsonb; rule shipping_item_rules%ROWTYPE;
  v_kg numeric; v_cbm numeric; v_qty numeric; v_unit numeric;
  rem_kg numeric; rem_cbm numeric; rem_val numeric; special_usd numeric; billed numeric; w_htg numeric; total numeric;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN RETURN; END IF;
  FOR r IN SELECT * FROM shipping_rates s WHERE s.active = true AND (p_country IS NULL OR public.rate_ships_from(s.id, p_country)) ORDER BY s.sort_order, s.name LOOP
    rem_kg := 0; rem_cbm := 0; rem_val := 0; special_usd := 0; w_htg := NULL;
    FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
      v_kg := coalesce((l ->> 'kg')::numeric, 0); v_cbm := coalesce((l ->> 'cbm')::numeric, 0);
      v_qty := coalesce((l ->> 'qty')::numeric, 1); v_unit := coalesce((l ->> 'unit_usd')::numeric, 0);
      rule := NULL;
      IF coalesce(l ->> 'item_type', '') <> '' THEN
        SELECT * INTO rule FROM shipping_item_rules ir
         WHERE ir.rate_id = r.id AND ir.item_type = l ->> 'item_type' AND ir.value_min_usd <= v_unit AND (ir.value_max_usd IS NULL OR v_unit <= ir.value_max_usd)
         ORDER BY ir.value_min_usd DESC LIMIT 1;
      END IF;
      IF rule.id IS NOT NULL THEN
        IF rule.mode = 'fixed' THEN special_usd := special_usd + rule.price_usd * v_qty; CONTINUE;
        ELSIF rule.mode = 'per_lb' THEN special_usd := special_usd + rule.price_usd * v_kg * 2.2046226; CONTINUE;
        ELSE special_usd := special_usd + rule.price_usd * v_qty; END IF;
      END IF;
      rem_kg := rem_kg + v_kg; rem_cbm := rem_cbm + v_cbm; rem_val := rem_val + v_unit * v_qty;
    END LOOP;

    billed := billed_weight_kg(r.volumetric_divisor, r.volumetric_unit, rem_kg, rem_cbm);
    IF billed > 0 THEN
      IF r.flat_price_usd IS NOT NULL AND billed / 0.45359237 <= r.flat_max_lb AND (r.flat_max_value_usd IS NULL OR rem_val <= r.flat_max_value_usd) THEN
        w_htg := round((r.flat_price_usd + coalesce(r.general_fee_usd, 0)) * usd);
      ELSE
        SELECT o.amount_htg INTO w_htg FROM shipping_options_for(rem_kg, rem_cbm, p_cat) o WHERE o.rate_id = r.id;
        IF w_htg IS NULL THEN CONTINUE; END IF;
      END IF;
    ELSIF special_usd > 0 THEN
      w_htg := round(coalesce(r.general_fee_usd, 0) * usd); billed := 0;
    ELSE
      CONTINUE;
    END IF;
    total := w_htg + round(special_usd * usd);
    IF total <= 0 THEN CONTINUE; END IF;
    rate_id := r.id; name := r.name; mode := r.mode; transit_days_min := r.transit_days_min; transit_days_max := r.transit_days_max;
    description := r.description; amount_htg := total; billed_kg := billed;
    RETURN NEXT;
  END LOOP;
END
$function$;
