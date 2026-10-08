-- The category coefficient (Branded x1.30…) only applies to parcels from China: rates leaving from another origin (USA) are priced at x1.
-- A rate without an origin keeps the coefficient (China by default). shipping_options_for is the single source of the shipping prices
-- (checkout, shipping after the warehouse, estimates), so every flow follows the rule.
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
         round((greatest(coalesce(r.min_amount_usd, 0),
                         coalesce(r.base_fee_usd, 0)
                         + CASE WHEN r.mode = 'ocean'
                                THEN greatest(coalesce(r.per_cbm_usd, 0) * coalesce(p_cbm, 0), coalesce(r.per_kg_usd, 0) * coalesce(p_kg, 0))
                                ELSE coalesce(r.per_kg_usd, 0) * coalesce(p_kg, 0) END)
                * (CASE WHEN upper(coalesce(so.country_code, 'CN')) = 'CN' THEN cfg.mult ELSE 1 END) + coalesce(r.general_fee_usd, 0)) * cfg.usd) AS amount_htg
    FROM shipping_rates r
    LEFT JOIN shipping_origins so ON so.id = r.origin_id
    CROSS JOIN cfg
   WHERE r.active = true
     AND (coalesce(p_kg, 0) > 0 OR coalesce(p_cbm, 0) > 0)
     AND (r.mode = 'ocean' OR coalesce(p_kg, 0) > 0)
     AND (r.max_weight_kg IS NULL OR coalesce(p_kg, 0) <= r.max_weight_kg)
   ORDER BY r.sort_order, r.name;
$function$;
