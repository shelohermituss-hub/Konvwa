-- ============================================================
-- KONVWA — Shipping quote flow: warehouses, product rate
-- categories, extended product_requests, and RPCs
-- ============================================================

-- ── 1. Warehouses table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  code           text         NOT NULL UNIQUE,
  name           text         NOT NULL,
  country_code   text         NOT NULL DEFAULT 'CN',
  flag_emoji     text,
  address_line1  text,
  address_line2  text,
  address_line3  text,
  city           text,
  state          text,
  postal_code    text,
  contact_info   text,
  instructions   text,
  notes          text,
  for_category   text         CHECK (for_category IN ('generic', 'branded', 'usa', 'all')) DEFAULT 'all',
  active         boolean      NOT NULL DEFAULT true,
  sort_order     integer      NOT NULL DEFAULT 0,
  created_at     timestamptz  DEFAULT now()
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_active_warehouses"
  ON warehouses FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "admin_all_warehouses"
  ON warehouses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

INSERT INTO warehouses (code, name, country_code, flag_emoji, address_line1, address_line2, city, state, postal_code, contact_info, instructions, for_category, sort_order) VALUES
  (
    'MCO-WH1',
    'Entrepôt USA — Orlando',
    'US', '🇺🇸',
    '6325 N Orange Blossom Trl Ste 132',
    NULL,
    'Orlando', 'Florida', '32810',
    'shelo hermitus',
    'Locker ID : HT06488 — Inscrire le numéro de locker sur chaque colis.',
    'usa', 1
  ),
  (
    'SHZ-WH1',
    'Entrepôt Chine — Shenzhen (Générique)',
    'CN', '🇨🇳',
    'Shenzhen, Guangdong',
    NULL,
    'Shenzhen', 'Guangdong', NULL,
    'shelo hermitus — WeChat : zhanghui294737',
    'Le fournisseur DOIT contacter WeChat ID : zhanghui294737 et indiquer le Locker ID# HT06488.',
    'generic', 2
  ),
  (
    'FSH-WH1',
    'Entrepôt Chine — Foshan (Marque)',
    'CN', '🇨🇳',
    '广东省佛山市南海区里水镇水口村环村路6号之1号',
    '(导航：广东城龙家居实业有限公司进入直走右转)',
    '佛山市', '广东省', NULL,
    '张小姐+JEFF — Tél: 17368212387 / 13018588665 / 1 866 511 6454 — WeChat: wxid_b4y0nr0fvr6f22',
    E'Horaires : Lun-Sam 9h00-18h00\nLe client doit envoyer le reçu de dépôt.\n务必要带入库通知单 / 外包装务必贴上入仓号',
    'branded', 3
  );

-- ── 2. Product rate categories ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_rate_categories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  slug            text        NOT NULL UNIQUE CHECK (slug IN ('generic', 'branded')),
  rate_multiplier numeric(5,2) NOT NULL DEFAULT 1.00,
  description     text,
  active          boolean     NOT NULL DEFAULT true,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE product_rate_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_active_categories"
  ON product_rate_categories FOR SELECT TO authenticated USING (active = true);

CREATE POLICY "admin_all_categories"
  ON product_rate_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')));

INSERT INTO product_rate_categories (name, slug, rate_multiplier, description, sort_order) VALUES
  ('Générique (sans marque)', 'generic', 1.00, 'Produits sans marque commerciale — tarifs standard.', 1),
  ('Marque / Branded',        'branded', 1.30, 'Produits de marque — supplément de 30 % sur les tarifs standard.', 2);

-- ── 3. Extend product_requests ─────────────────────────────────────────────────

-- Drop old status constraint and recreate with extended values
ALTER TABLE product_requests
  DROP CONSTRAINT IF EXISTS product_requests_status_check;

ALTER TABLE product_requests
  ADD CONSTRAINT product_requests_status_check
  CHECK (status IN (
    'draft', 'submitted', 'reviewing', 'quoted',
    'rejected', 'received', 'invoiced', 'cancelled'
  ));

ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS warehouse_id              uuid REFERENCES warehouses(id),
  ADD COLUMN IF NOT EXISTS product_rate_category_id  uuid REFERENCES product_rate_categories(id),
  ADD COLUMN IF NOT EXISTS estimated_cbm             numeric(10,4),
  ADD COLUMN IF NOT EXISTS estimated_kg              numeric(10,2),
  ADD COLUMN IF NOT EXISTS actual_cbm                numeric(10,4),
  ADD COLUMN IF NOT EXISTS actual_kg                 numeric(10,2),
  ADD COLUMN IF NOT EXISTS quoted_amount_htg         numeric(12,2),
  ADD COLUMN IF NOT EXISTS actual_amount_htg         numeric(12,2),
  ADD COLUMN IF NOT EXISTS quoted_rate_id            uuid REFERENCES shipping_rates(id),
  ADD COLUMN IF NOT EXISTS quoted_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS received_at               timestamptz,
  ADD COLUMN IF NOT EXISTS invoiced_at               timestamptz,
  ADD COLUMN IF NOT EXISTS package_count             integer,
  ADD COLUMN IF NOT EXISTS admin_notes               text;

-- ── 4. RPC: request_shipping_quote (client) ─────────────────────────────────
CREATE OR REPLACE FUNCTION request_shipping_quote(
  p_product_category_slug text,
  p_warehouse_id          uuid,
  p_notes                 text    DEFAULT NULL,
  p_package_count         integer DEFAULT NULL,
  p_estimated_cbm         numeric DEFAULT NULL,
  p_estimated_kg          numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat    product_rate_categories%ROWTYPE;
  v_wh     warehouses%ROWTYPE;
  v_req_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_cat FROM product_rate_categories
    WHERE slug = p_product_category_slug AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Catégorie de produit invalide.');
  END IF;

  SELECT * INTO v_wh FROM warehouses WHERE id = p_warehouse_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Entrepôt introuvable.');
  END IF;

  INSERT INTO product_requests (
    user_id, request_type, status,
    product_url, product_name, category, quantity,
    notes, source_platform,
    warehouse_id, product_rate_category_id,
    estimated_cbm, estimated_kg, package_count
  ) VALUES (
    auth.uid(), 'shipping', 'submitted',
    '', 'Cargaison', 'other', 1,
    p_notes, 'other',
    p_warehouse_id, v_cat.id,
    p_estimated_cbm, p_estimated_kg, p_package_count
  ) RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;

GRANT EXECUTE ON FUNCTION request_shipping_quote(text, uuid, text, integer, numeric, numeric) TO authenticated;

-- ── 5. RPC: admin_send_shipping_quote ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_send_shipping_quote(
  p_request_id        uuid,
  p_actual_cbm        numeric,
  p_actual_kg         numeric,
  p_quoted_amount_htg numeric,
  p_quoted_rate_id    uuid   DEFAULT NULL,
  p_admin_notes       text   DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req product_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF v_req.request_type != 'shipping' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande n''est pas une demande d''expédition.');
  END IF;
  IF v_req.status NOT IN ('submitted', 'reviewing') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut incompatible avec l''envoi d''un devis.');
  END IF;

  UPDATE product_requests SET
    status            = 'quoted',
    actual_cbm        = p_actual_cbm,
    actual_kg         = p_actual_kg,
    quoted_amount_htg = p_quoted_amount_htg,
    quoted_rate_id    = p_quoted_rate_id,
    quoted_at         = now(),
    admin_notes       = COALESCE(p_admin_notes, admin_notes),
    updated_at        = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_req.user_id,
    'Devis d''expédition reçu',
    'Votre devis est prêt : ' || to_char(p_quoted_amount_htg, 'FM999,999,990') || ' HTG (estimation).',
    'info',
    '/expeditions'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_send_shipping_quote(uuid, numeric, numeric, numeric, uuid, text) TO authenticated;

-- ── 6. RPC: admin_mark_shipping_received ──────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_mark_shipping_received(
  p_request_id  uuid,
  p_admin_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req product_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF v_req.status NOT IN ('submitted', 'reviewing', 'quoted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut incompatible.');
  END IF;

  UPDATE product_requests SET
    status      = 'received',
    received_at = now(),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    updated_at  = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_req.user_id,
    'Colis reçu en entrepôt',
    'Vos colis ont bien été reçus dans notre entrepôt. La facture arrivera prochainement.',
    'info',
    '/expeditions'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_mark_shipping_received(uuid, text) TO authenticated;

-- ── 7. RPC: admin_invoice_shipment ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_invoice_shipment(
  p_request_id      uuid,
  p_final_amount_htg numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req       product_requests%ROWTYPE;
  v_wallet_id uuid;
  v_balance   numeric;
  v_amount    numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF v_req.status != 'received' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le colis doit d''abord être marqué reçu.');
  END IF;

  v_amount := COALESCE(p_final_amount_htg, v_req.actual_amount_htg, v_req.quoted_amount_htg);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant de facturation manquant ou invalide.');
  END IF;

  SELECT id, available_balance INTO v_wallet_id, v_balance
    FROM wallets WHERE user_id = v_req.user_id;
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille client introuvable.');
  END IF;
  IF v_balance < v_amount THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible).');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_amount WHERE id = v_wallet_id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (
    v_wallet_id, 'payment', v_amount, 'completed',
    'Frais d''expédition — demande #' || left(p_request_id::text, 8)
  );

  UPDATE product_requests SET
    status            = 'invoiced',
    actual_amount_htg = v_amount,
    invoiced_at       = now(),
    updated_at        = now()
  WHERE id = p_request_id;

  INSERT INTO notifications (user_id, title, body, type, link)
  VALUES (
    v_req.user_id,
    'Expédition facturée',
    to_char(v_amount, 'FM999,999,990') || ' HTG débités pour votre expédition.',
    'info',
    '/expeditions'
  );

  RETURN jsonb_build_object('success', true, 'amount_htg', v_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_invoice_shipment(uuid, numeric) TO authenticated;
