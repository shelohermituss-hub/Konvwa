-- The minimum order quantity (MOQ) and the hand-made quantity tiers of a product apply to the TOTAL quantity of that product in the order
-- (all its variants / option choices together), not to each line: 5 variants can be bought 4 by 4 when the MOQ is 20.
-- Supplier offers ("2 for $40") stay per line. Same function as before, patched in place.
DO $$
DECLARE d text; n text;
BEGIN
  d := pg_get_functiondef('public.create_product_order(jsonb,text)'::regprocedure);
  n := d;
  n := replace(n, E'  v_opts     jsonb;\n', E'  v_opts     jsonb;\n  v_tot      jsonb;\n  v_ptotal   integer;\n');
  n := replace(n, 'FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP',
    E'-- total quantity of each product across its lines\n  SELECT coalesce(jsonb_object_agg(pid, q), ''{}''::jsonb) INTO v_tot FROM (\n    SELECT ((e->>''product_id'')::uuid)::text AS pid, sum(CASE WHEN e->>''quantity'' ~ ''^[0-9]{1,7}$'' THEN (e->>''quantity'')::integer ELSE 0 END) AS q\n      FROM jsonb_array_elements(p_items) e GROUP BY 1) s;\n\n  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP');
  n := replace(n, 'v_qty := (v_item->>''quantity'')::integer;',
    E'v_qty := (v_item->>''quantity'')::integer;\n    v_ptotal := greatest(coalesce(v_qty, 0), coalesce((v_tot->>(((v_item->>''product_id'')::uuid)::text))::integer, 0));');
  n := replace(n, 'IF v_qty < v_prod.moq THEN', 'IF v_ptotal < v_prod.moq THEN');
  n := replace(n, 'RAISE EXCEPTION ''Quantité minimale pour « % » : % %'', v_prod.name, v_prod.moq, v_prod.unit;', 'RAISE EXCEPTION ''Quantité minimale pour « % » : % % au total (toutes variantes confondues)'', v_prod.name, v_prod.moq, v_prod.unit;');
  n := replace(n, '<> ''sync''), v_qty);', '<> ''sync''), v_ptotal);');
  IF n = d OR position('v_ptotal < v_prod.moq' IN n) = 0 OR position('<> ''sync''), v_ptotal)' IN n) = 0 OR position('v_tot      jsonb' IN n) = 0 OR position('jsonb_object_agg(pid, q)' IN n) = 0 OR position('au total (toutes' IN n) = 0 THEN
    RAISE EXCEPTION 'create_product_order was not patched as expected';
  END IF;
  EXECUTE n;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_product_order(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_order(jsonb, text) TO authenticated;
