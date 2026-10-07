-- Prices are public: the Facebook catalogue ads (dynamic product ads) require the price of the feed to be visible on the product page, for everyone.
-- Only the selling prices become readable by visitors; the supplier price, margin data, reseller discount, weight, source link… stay private.
GRANT SELECT (price_htg, price_tiers) ON public.products TO anon;
GRANT SELECT (price_htg) ON public.product_variants TO anon;
