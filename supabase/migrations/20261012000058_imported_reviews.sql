-- Reviews read from the supplier page at import time (Amazon, Muscle & Strength…): kept apart from the reviews of KONVWA customers
-- (product_reviews, linked to an account and a real purchase) and always shown with their source. Read-only for everyone, written only by the admin import.
CREATE TABLE IF NOT EXISTS public.imported_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('amazon', 'muscle_strength', 'alibaba', 'shein', 'temu')),
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 80),
  rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title       text NOT NULL DEFAULT '' CHECK (char_length(title) <= 160),
  comment     text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  reviewed_at date,
  source_url  text CHECK (source_url IS NULL OR source_url ~* '^https://'),
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (comment <> '' OR title <> '')
);
CREATE INDEX IF NOT EXISTS imported_reviews_product_idx ON public.imported_reviews (product_id, created_at DESC);
ALTER TABLE public.imported_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.imported_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.imported_reviews TO anon, authenticated;

-- visitors: reviews of the products they can see (no is_admin / is_reseller call: anon may not run them)
DROP POLICY IF EXISTS imported_reviews_guest_read ON public.imported_reviews;
CREATE POLICY imported_reviews_guest_read ON public.imported_reviews FOR SELECT TO anon
  USING (NOT hidden AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = imported_reviews.product_id AND p.active = true AND p.is_active = true AND NOT p.wholesale_only));

DROP POLICY IF EXISTS imported_reviews_auth_read ON public.imported_reviews;
CREATE POLICY imported_reviews_auth_read ON public.imported_reviews FOR SELECT TO authenticated
  USING (public.is_admin() OR (NOT hidden AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = imported_reviews.product_id AND p.active = true AND (NOT p.wholesale_only OR public.is_reseller()))));

-- Admin import: replaces the reviews of one source for a product (at most 30). No direct write policy exists.
CREATE OR REPLACE FUNCTION public.admin_save_imported_reviews(p_product uuid, p_source text, p_source_url text, p_reviews jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item jsonb; v_n integer := 0; v_date date;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  PERFORM 1 FROM products WHERE id = p_product FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Produit introuvable.'); END IF;
  IF p_reviews IS NULL OR jsonb_typeof(p_reviews) <> 'array' OR jsonb_array_length(p_reviews) > 30 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liste d''avis invalide (30 maximum).');
  END IF;
  DELETE FROM imported_reviews WHERE product_id = p_product AND source = p_source;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_reviews) LOOP
    v_date := nullif(v_item ->> 'date', '')::date;
    IF v_date > current_date THEN v_date := NULL; END IF;
    INSERT INTO imported_reviews (product_id, source, author_name, rating, title, comment, reviewed_at, source_url)
    VALUES (p_product, p_source, coalesce(nullif(btrim(v_item ->> 'author'), ''), 'Client'), (v_item ->> 'rating')::integer,
            coalesce(btrim(v_item ->> 'title'), ''), coalesce(btrim(v_item ->> 'text'), ''), v_date, nullif(btrim(p_source_url), ''));
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'count', v_n);
EXCEPTION WHEN check_violation OR invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN
  RETURN jsonb_build_object('success', false, 'error', 'Avis invalide : note de 1 à 5, texte ou titre présent, source en https.');
END $$;
REVOKE ALL ON FUNCTION public.admin_save_imported_reviews(uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_imported_reviews(uuid, text, text, jsonb) TO authenticated;
