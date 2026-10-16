-- Southood products already imported: photos on the cases and a colour choice for the photochromic lenses (pictures hot-linked from the shop's options app; new imports copy them into our bucket)
DO $$
DECLARE
  p record; gl uuid; gc uuid; ids uuid[];
  cases jsonb := '{"Blue": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1ibHVlLmpwZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MjAwLCJmaXQiOiJjb250YWluIn19fQ==", "Brown": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1icm93bi5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2lkdGgiOjIwMCwiZml0IjoiY29udGFpbiJ9fX0=", "Red": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1yZWQuanBnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoyMDAsImZpdCI6ImNvbnRhaW4ifX19", "Rose red": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1yb3NlcmVkLmpwZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MjAwLCJmaXQiOiJjb250YWluIn19fQ==", "Silver": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1zaWx2ZXIuanBnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoyMDAsImZpdCI6ImNvbnRhaW4ifX19", "Black": "https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1ibGFjay5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2lkdGgiOjIwMCwiZml0IjoiY29udGFpbiJ9fX0="}'::jsonb;
  -- fr label, en label, picture
  lens text[][] := ARRAY[
    ['Gris','Gray','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QR3JheS5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2lkdGgiOjIwMCwiZml0IjoiY29udGFpbiJ9fX0='],
    ['Marron','Brown','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QQnJvd24uanBnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoyMDAsImZpdCI6ImNvbnRhaW4ifX19'],
    ['Bleu','Blue','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QaG90b2Nocm9taWNCbHVlLmpwZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MjAwLCJmaXQiOiJjb250YWluIn19fQ=='],
    ['Violet','Purple','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QaG90b2Nocm9taWNQdXJwbGUuanBnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjoyMDAsImZpdCI6ImNvbnRhaW4ifX19'],
    ['Rose','Pink','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QaG90b2Nocm9taWNQaW5rLmpwZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MjAwLCJmaXQiOiJjb250YWluIn19fQ=='],
    ['Vert','Green','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QLUdyZWVuLmpwZyIsImVkaXRzIjp7InJlc2l6ZSI6eyJ3aWR0aCI6MjAwLCJmaXQiOiJjb250YWluIn19fQ=='],
    ['Orange','Orange','https://d17fzo7x83uajt.cloudfront.net/eyJidWNrZXQiOiJiY3BvIiwia2V5IjoiZXM0Z2l0LTB4Lm15c2hvcGlmeS5jb20vOTg1MjMxMDQ1NDU0Ni1QLU9yYW5nZS5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2lkdGgiOjIwMCwiZml0IjoiY29udGFpbiJ9fX0=']
  ];
  i integer;
BEGIN
  FOR p IN SELECT DISTINCT g.product_id AS id FROM product_option_groups g JOIN products pr ON pr.id = g.product_id
            WHERE pr.source_url ILIKE '%southoodeyewear.com%' AND g.name = 'Verres'
              AND NOT EXISTS (SELECT 1 FROM product_option_groups c WHERE c.product_id = g.product_id AND c.name = 'Couleur du verre photochromique') LOOP
    SELECT id INTO gl FROM product_option_groups WHERE product_id = p.id AND name = 'Verres';
    SELECT coalesce(array_agg(id), '{}') INTO ids FROM product_options WHERE group_id = gl AND label ILIKE '%photochromique%';
    -- room for the colour group right after the lenses
    UPDATE product_option_groups SET sort_order = sort_order + 1 WHERE product_id = p.id AND sort_order >= 1;
    INSERT INTO product_option_groups (product_id, name, name_en, sort_order, required, multi, show_when_group, show_when_options)
      VALUES (p.id, 'Couleur du verre photochromique', 'Photochromic lens colour', 1, true, false, gl, ids) RETURNING id INTO gc;
    FOR i IN 1..array_length(lens, 1) LOOP
      INSERT INTO product_options (group_id, label, label_en, image, price_htg, sort_order) VALUES (gc, lens[i][1], lens[i][2], lens[i][3], 0, i - 1);
    END LOOP;
    UPDATE product_options o SET image = cases ->> o.label_en
      FROM product_option_groups g WHERE o.group_id = g.id AND g.product_id = p.id AND g.name = 'Étui' AND o.image IS NULL AND cases ? o.label_en;
  END LOOP;
END $$;
