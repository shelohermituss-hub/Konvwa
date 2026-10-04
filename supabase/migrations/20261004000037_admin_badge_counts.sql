-- Counts of new / pending items shown as badges in the admin sidebar (staff only; clients get an empty object).
CREATE OR REPLACE FUNCTION public.admin_badge_counts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN RETURN '{}'::jsonb; END IF;
  RETURN jsonb_build_object(
    'quotes', (SELECT count(*) FROM product_requests WHERE coalesce(request_type, 'product') <> 'shipping' AND status IN ('submitted', 'reviewing')),
    'orders', (SELECT count(*) FROM orders WHERE status = 'paid')
            + (SELECT count(*) FROM orders WHERE status = 'shipping_paid' AND shipment_id IS NULL),
    'product_orders', (SELECT count(*) FROM product_orders WHERE payment_status = 'paid' AND tracking_status = 'paid')
            + (SELECT count(*) FROM product_orders WHERE payment_status = 'paid' AND tracking_status = 'shipping_paid' AND shipment_id IS NULL),
    'cargos', (SELECT count(*) FROM product_requests WHERE request_type = 'shipping' AND source_order_kind IS NULL AND status IN ('submitted', 'reviewing'))
            + (SELECT count(*) FROM product_requests WHERE request_type = 'shipping' AND source_order_kind IS NULL AND status IN ('invoiced', 'deposit_paid') AND shipment_id IS NULL),
    'payments', (SELECT count(*) FROM wallet_transactions WHERE type = 'deposit' AND status = 'pending'),
    'disputes', (SELECT count(*) FROM support_tickets WHERE status = 'open'),
    'kyc', (SELECT count(*) FROM kyc_submissions WHERE status = 'pending'),
    'resellers', (SELECT count(*) FROM reseller_applications WHERE status = 'pending')
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_badge_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_badge_counts() TO authenticated;
