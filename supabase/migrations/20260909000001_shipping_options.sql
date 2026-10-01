-- ── Shipping methods table ─────────────────────────────────────────────────────
CREATE TABLE shipping_methods (
  id                 uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text         NOT NULL,
  description        text,
  price_htg          numeric(12,2) NOT NULL,
  duration_days_min  integer      NOT NULL,
  duration_days_max  integer      NOT NULL,
  mode               text         NOT NULL DEFAULT 'sea' CHECK (mode IN ('air', 'sea', 'express')),
  active             boolean      NOT NULL DEFAULT true,
  sort_order         integer      NOT NULL DEFAULT 0,
  created_at         timestamptz  DEFAULT now()
);

INSERT INTO shipping_methods (name, description, price_htg, duration_days_min, duration_days_max, mode, sort_order) VALUES
  ('Économique Maritime', 'Expédition maritime standard.',          15000, 30, 45, 'sea',     1),
  ('Standard Maritime',   'Expédition maritime avec priorité.',    22000, 20, 30, 'sea',     2),
  ('Aérien Standard',     'Expédition aérienne standard.',         45000,  7, 14, 'air',     3),
  ('Aérien Express',      'Expédition aérienne express prioritaire.', 75000, 3, 7, 'express', 4);

ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_active_shipping_methods"
  ON shipping_methods FOR SELECT TO authenticated USING (active = true);

-- ── Add shipping_option to product_requests ────────────────────────────────────
ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS shipping_option text NOT NULL DEFAULT 'all_inclusive'
  CHECK (shipping_option IN ('all_inclusive', 'separate'));

-- ── Add columns to orders ──────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_option              text      NOT NULL DEFAULT 'all_inclusive'
    CHECK (shipping_option IN ('all_inclusive', 'separate')),
  ADD COLUMN IF NOT EXISTS chosen_shipping_method_id   uuid      REFERENCES shipping_methods(id),
  ADD COLUMN IF NOT EXISTS shipping_method_confirmed_at timestamptz;

-- ── RPC: choose_shipping_method ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION choose_shipping_method(
  p_order_id          uuid,
  p_shipping_method_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.');
  END IF;

  IF v_order.user_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Accès non autorisé.');
  END IF;

  IF v_order.status != 'in_china_warehouse' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La commande n''est pas en entrepôt Chine.');
  END IF;

  IF v_order.shipping_option != 'separate' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''utilise pas l''expédition séparée.');
  END IF;

  IF v_order.chosen_shipping_method_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Une méthode d''expédition a déjà été choisie.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM shipping_methods WHERE id = p_shipping_method_id AND active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Méthode d''expédition invalide ou inactive.');
  END IF;

  UPDATE orders
  SET
    chosen_shipping_method_id    = p_shipping_method_id,
    shipping_method_confirmed_at = now(),
    status                       = 'shipped',
    updated_at                   = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION choose_shipping_method(uuid, uuid) TO authenticated;
