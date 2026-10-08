-- Volumetric weight by centimetres (L x W x H / 2000) is a result in KILOGRAMS (inches / 132 stays in pounds).
CREATE OR REPLACE FUNCTION public.billed_weight_kg(p_divisor numeric, p_unit text, p_kg numeric, p_cbm numeric)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_unit = 'none' THEN coalesce(p_kg, 0)
    WHEN p_divisor > 0 AND p_unit = 'cm' THEN greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 1000000 / p_divisor)
    WHEN p_divisor > 0 THEN greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 1000000 / 16.387064 / p_divisor / 2.2046226)
    ELSE greatest(coalesce(p_kg, 0), coalesce(p_cbm, 0) * 166.6667)
  END;
$function$;
