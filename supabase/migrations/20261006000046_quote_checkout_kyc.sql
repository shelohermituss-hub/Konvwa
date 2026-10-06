-- The checkout quote also applies the identity (KYC) rule of the amount, so a gateway payment is refused before it starts.
CREATE OR REPLACE FUNCTION public.quote_checkout(p_items jsonb, p_rate uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  BEGIN
    res := public.create_product_checkout(p_items, p_rate, NULL);
    IF coalesce((res ->> 'success')::boolean, false) AND NOT public.kyc_ok(ceil((res ->> 'total')::numeric)) THEN
      res := jsonb_build_object('success', false, 'code', 'kyc_required', 'error', 'Vérification d''identité requise pour ce paiement.');
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0999', MESSAGE = res::text;
  EXCEPTION
    WHEN SQLSTATE 'P0999' THEN RETURN SQLERRM::jsonb;
    WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.quote_checkout(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_checkout(jsonb, uuid) TO authenticated;
