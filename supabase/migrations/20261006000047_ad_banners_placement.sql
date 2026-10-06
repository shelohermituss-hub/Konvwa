-- Where an ad is shown: the banner area, the product feed (as a "sponsored" card that looks like a product), or both.
ALTER TABLE public.ad_banners ADD COLUMN IF NOT EXISTS placement text NOT NULL DEFAULT 'banner';
ALTER TABLE public.ad_banners ADD CONSTRAINT ad_banners_placement_chk CHECK (placement IN ('banner', 'feed', 'both'));
