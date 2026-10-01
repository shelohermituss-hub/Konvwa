-- Migration: add origin_country and destination_address to product_requests
-- and update request_shipping_quote RPC to accept them

ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS origin_country    text,      -- e.g. 'CN', 'US'
  ADD COLUMN IF NOT EXISTS destination_address text;    -- free text, city/address in Haiti

-- Update RPC to accept origin and destination
CREATE OR REPLACE FUNCTION request_shipping_quote(
  p_product_category_slug  text,
  p_warehouse_id           uuid,
  p_notes                  text    DEFAULT NULL,
  p_package_count          integer DEFAULT NULL,
  p_estimated_cbm          numeric DEFAULT NULL,
  p_estimated_kg           numeric DEFAULT NULL,
  p_origin_country         text    DEFAULT NULL,
  p_destination_address    text    DEFAULT NULL
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
    estimated_cbm, estimated_kg, package_count,
    origin_country, destination_address
  ) VALUES (
    auth.uid(), 'shipping', 'submitted',
    '', 'Cargaison', 'other', 1,
    p_notes, 'other',
    p_warehouse_id, v_cat.id,
    p_estimated_cbm, p_estimated_kg, p_package_count,
    p_origin_country, p_destination_address
  ) RETURNING id INTO v_req_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_req_id);
END;
$$;

GRANT EXECUTE ON FUNCTION request_shipping_quote(text, uuid, text, integer, numeric, numeric, text, text) TO authenticated;
