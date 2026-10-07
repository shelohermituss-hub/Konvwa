-- Refusing a price change keeps the shop's price AND the reference price: when the supplier's price comes back (end of a sale),
-- the follow-up sees an ordinary change instead of a huge one. The Edge Function does not propose the same refused price again.
CREATE OR REPLACE FUNCTION public.admin_resolve_price_review(p_log uuid, p_accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l price_sync_log%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO l FROM price_sync_log WHERE id = p_log FOR UPDATE;
  IF NOT FOUND OR l.status <> 'review' OR l.resolved_at IS NOT NULL THEN RAISE EXCEPTION 'already resolved'; END IF;
  IF p_accept THEN
    PERFORM apply_price_sync(l.product_id, l.new_usd, l.promos, p_log);
  ELSE
    UPDATE products SET price_checked_at = now() WHERE id = l.product_id;
    UPDATE price_sync_log SET status = 'refused', resolved_at = now() WHERE id = p_log;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_price_review(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_price_review(uuid, boolean) TO authenticated;
