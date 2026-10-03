-- A catalogue order follows its cargo: when the batch of its shipping request leaves / is delivered, the order status follows.

CREATE OR REPLACE FUNCTION public.sync_product_orders_with_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'delivered' THEN
      UPDATE product_orders po SET status = 'delivered', updated_at = now()
        FROM product_requests pr
       WHERE pr.shipment_id = NEW.id AND po.shipping_request_id = pr.id AND po.status NOT IN ('cancelled', 'delivered');
    ELSIF NEW.status IN ('shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery') THEN
      UPDATE product_orders po SET status = 'shipped', updated_at = now()
        FROM product_requests pr
       WHERE pr.shipment_id = NEW.id AND po.shipping_request_id = pr.id AND po.status = 'processing';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_product_orders_with_shipment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_sync_product_orders_with_shipment
  AFTER UPDATE OF status ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_orders_with_shipment();
