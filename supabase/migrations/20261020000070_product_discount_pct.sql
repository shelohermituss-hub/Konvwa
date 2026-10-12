-- "Réductions": the old (struck) price shown next to the selling price. Stored as a percentage so it follows the price when the nightly
-- price follow-up changes it: old price = price / (1 - discount_pct / 100). Display only: what the customer pays is always price_htg.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS discount_pct integer CONSTRAINT products_discount_pct_check CHECK (discount_pct IS NULL OR discount_pct BETWEEN 5 AND 90);

-- public like the selling prices (visitors see the struck price and the % off); no other column opens
GRANT SELECT (discount_pct) ON public.products TO anon;
