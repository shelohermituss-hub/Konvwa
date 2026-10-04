-- An order must keep the shipping option chosen on the request (it was reset to "all_inclusive" when the team created the order).
CREATE OR REPLACE FUNCTION public.order_inherit_shipping_option()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT pr.shipping_option INTO NEW.shipping_option
    FROM quotes q JOIN product_requests pr ON pr.id = q.request_id
   WHERE q.id = NEW.quote_id;
  NEW.shipping_option := coalesce(NEW.shipping_option, 'all_inclusive');
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.order_inherit_shipping_option() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_order_inherit_shipping_option BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_inherit_shipping_option();

-- repair the existing orders that lost the option
UPDATE public.orders o SET shipping_option = pr.shipping_option
  FROM public.quotes q JOIN public.product_requests pr ON pr.id = q.request_id
 WHERE q.id = o.quote_id AND o.shipping_option IS DISTINCT FROM pr.shipping_option AND o.shipping_paid_at IS NULL;
