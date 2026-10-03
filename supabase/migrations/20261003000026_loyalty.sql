-- Loyalty tiers: based on paid orders; the benefit is a discount on the service fee, applied by the team when quoting

INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('loyalty_silver_orders', '3', 'Fidélité — commandes pour le niveau Argent', 'Nombre de commandes payées.', false),
  ('loyalty_gold_orders', '10', 'Fidélité — commandes pour le niveau Or', 'Nombre de commandes payées.', false),
  ('loyalty_silver_discount_pct', '5', 'Fidélité — remise Argent sur les frais de service (%)', 'Appliquée par l''équipe lors du devis.', false),
  ('loyalty_gold_discount_pct', '10', 'Fidélité — remise Or sur les frais de service (%)', 'Appliquée par l''équipe lors du devis.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.loyalty_for(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  integer;
  v_silver integer := coalesce((SELECT value::integer FROM app_settings WHERE key = 'loyalty_silver_orders'), 3);
  v_gold   integer := coalesce((SELECT value::integer FROM app_settings WHERE key = 'loyalty_gold_orders'), 10);
  v_s_pct  numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'loyalty_silver_discount_pct'), 5);
  v_g_pct  numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'loyalty_gold_discount_pct'), 10);
  v_tier   text;
  v_pct    numeric;
  v_next   integer;
BEGIN
  SELECT (SELECT count(*) FROM orders WHERE user_id = p_user AND payment_status = 'paid')
       + (SELECT count(*) FROM product_orders WHERE user_id = p_user AND payment_status = 'paid')
    INTO v_count;
  IF v_count >= v_gold THEN v_tier := 'gold'; v_pct := v_g_pct; v_next := NULL;
  ELSIF v_count >= v_silver THEN v_tier := 'silver'; v_pct := v_s_pct; v_next := v_gold;
  ELSE v_tier := 'bronze'; v_pct := 0; v_next := v_silver;
  END IF;
  RETURN jsonb_build_object('tier', v_tier, 'orders', v_count, 'discount_pct', v_pct, 'next_at', v_next,
                            'silver_pct', v_s_pct, 'gold_pct', v_g_pct, 'silver_at', v_silver, 'gold_at', v_gold);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.loyalty_for(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_loyalty()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT CASE WHEN (SELECT auth.uid()) IS NULL THEN NULL ELSE public.loyalty_for((SELECT auth.uid())) END $$;
REVOKE EXECUTE ON FUNCTION public.my_loyalty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_loyalty() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_customer_loyalty(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT CASE WHEN public.is_admin() THEN public.loyalty_for(p_user_id) ELSE NULL END $$;
REVOKE EXECUTE ON FUNCTION public.admin_customer_loyalty(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_loyalty(uuid) TO authenticated;
