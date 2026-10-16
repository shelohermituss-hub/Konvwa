-- A group can be shown only when one of SOME options of its parent group is chosen (e.g. the photochromic colours only after a photochromic lens).
ALTER TABLE public.product_option_groups ADD COLUMN show_when_options uuid[] NOT NULL DEFAULT '{}' CHECK (cardinality(show_when_options) <= 30);

CREATE OR REPLACE FUNCTION public.price_product_options(p_product uuid, p_option_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[] := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(p_option_ids, '{}'::uuid[])) x);
  g record; v_visible boolean; v_has boolean; v_total numeric; v_label text;
BEGIN
  IF cardinality(v_ids) > 30 THEN RAISE EXCEPTION 'Trop d''options sélectionnées'; END IF;
  IF (SELECT count(*) FROM product_options o JOIN product_option_groups pg ON pg.id = o.group_id
       WHERE o.id = ANY(v_ids) AND pg.product_id = p_product AND o.active) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'Option indisponible pour ce produit';
  END IF;
  FOR g IN SELECT * FROM product_option_groups WHERE product_id = p_product ORDER BY sort_order, name LOOP
    v_visible := (g.show_when_group IS NULL OR EXISTS (SELECT 1 FROM product_options o WHERE o.group_id = g.show_when_group AND o.id = ANY(v_ids)))
             AND (cardinality(g.show_when_options) = 0 OR g.show_when_options && v_ids);
    SELECT EXISTS (SELECT 1 FROM product_options o WHERE o.group_id = g.id AND o.id = ANY(v_ids)) INTO v_has;
    IF v_has AND NOT v_visible THEN RAISE EXCEPTION 'Option non disponible avec ce choix : %', g.name; END IF;
    IF NOT g.multi AND (SELECT count(*) FROM product_options o WHERE o.group_id = g.id AND o.id = ANY(v_ids)) > 1 THEN
      RAISE EXCEPTION 'Une seule option possible pour « % »', g.name;
    END IF;
    IF v_visible AND g.required AND NOT v_has THEN RAISE EXCEPTION 'Choisissez une option pour « % »', g.name; END IF;
  END LOOP;
  SELECT coalesce(sum(o.price_htg), 0),
         coalesce(string_agg(pg.name || ' : ' || o.label, ' · ' ORDER BY pg.sort_order, pg.name, o.sort_order), '')
    INTO v_total, v_label
    FROM product_options o JOIN product_option_groups pg ON pg.id = o.group_id WHERE o.id = ANY(v_ids);
  RETURN jsonb_build_object('total_htg', v_total, 'label', v_label);
END $$;
REVOKE EXECUTE ON FUNCTION public.price_product_options(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
