-- ============================================================
-- KONVWA — performance + storage hardening (applied to the live DB via the Supabase MCP)
-- ============================================================

-- 1. Index every foreign key that had no covering index
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON public.beneficiaries (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items (product_id);
CREATE INDEX IF NOT EXISTS idx_currency_accounts_user_id ON public.currency_accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_addresses_user_id ON public.delivery_addresses (user_id);
CREATE INDEX IF NOT EXISTS idx_haiti_cities_region_id ON public.haiti_cities (region_id);
CREATE INDEX IF NOT EXISTS idx_jars_user_id ON public.jars (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_shipments_shipment_id ON public.order_shipments (shipment_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_by ON public.order_status_history (created_by);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_chosen_shipping_method_id ON public.orders (chosen_shipping_method_id);
CREATE INDEX IF NOT EXISTS idx_orders_chosen_shipping_rate_id ON public.orders (chosen_shipping_rate_id);
CREATE INDEX IF NOT EXISTS idx_orders_quote_id ON public.orders (quote_id);
CREATE INDEX IF NOT EXISTS idx_product_order_items_order_id ON public.product_order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_product_order_items_product_id ON public.product_order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_product_orders_user_id ON public.product_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_destination_city_id ON public.product_requests (destination_city_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_destination_region_id ON public.product_requests (destination_region_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_product_rate_category_id ON public.product_requests (product_rate_category_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_product_type_id ON public.product_requests (product_type_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_quoted_rate_id ON public.product_requests (quoted_rate_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_ship_from_id ON public.product_requests (ship_from_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_shipment_id ON public.product_requests (shipment_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_shipping_rate_id ON public.product_requests (shipping_rate_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_warehouse_id ON public.product_requests (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_quotes_request_id ON public.quotes (request_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_origin_id ON public.shipping_rates (origin_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender_id ON public.support_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id ON public.support_tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions (user_id);

-- 2. RLS: evaluate auth.uid() once per query instead of once per row
DO $$
DECLARE
  r record; new_q text; new_c text; stmt text;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, cl.relname AS tbl, p.polname AS pol,
           pg_get_expr(p.polqual, p.polrelid) AS q, pg_get_expr(p.polwithcheck, p.polrelid) AS c
      FROM pg_policy p
      JOIN pg_class cl ON cl.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = cl.relnamespace
     WHERE n.nspname = 'public'
  LOOP
    new_q := r.q; new_c := r.c;
    IF new_q IS NOT NULL AND new_q !~* 'select auth\.' THEN
      new_q := regexp_replace(new_q, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    END IF;
    IF new_c IS NOT NULL AND new_c !~* 'select auth\.' THEN
      new_c := regexp_replace(new_c, 'auth\.(uid|role|jwt)\(\)', '(select auth.\1())', 'g');
    END IF;
    IF new_q IS DISTINCT FROM r.q OR new_c IS DISTINCT FROM r.c THEN
      stmt := format('ALTER POLICY %I ON %I.%I', r.pol, r.sch, r.tbl);
      IF new_q IS NOT NULL THEN stmt := stmt || ' USING (' || new_q || ')'; END IF;
      IF new_c IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || new_c || ')'; END IF;
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

-- 3. Product photos: own folder only, images only, 10 MB max
ALTER POLICY product_images_insert ON storage.objects
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
 WHERE id = 'product-images';

-- 4. Remaining mutable search_path
ALTER FUNCTION increment_wallet_balance(uuid, numeric) SET search_path = public;
ALTER FUNCTION choose_shipping_method(uuid, uuid) SET search_path = public;
ALTER FUNCTION choose_shipping_method(uuid, uuid, numeric) SET search_path = public;

-- ── To run by hand in the Supabase SQL editor (the MCP refuses DROP statements) ──
-- DROP INDEX IF EXISTS public.push_subscriptions_user_endpoint_idx;  -- identical to push_subscriptions_user_endpoint_unique
-- DROP EXTENSION pg_net;
-- CREATE EXTENSION pg_net WITH SCHEMA extensions;
