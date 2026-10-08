-- Logo of the company that carries the parcel and gives the rate: shown to the customer when he chooses a shipping method.
-- Set by the admin in Configuration > Tarifs d'expédition (image stored in the product-images bucket, address in https).
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS carrier_logo_url text;
ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_carrier_logo_https;
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_carrier_logo_https
  CHECK (carrier_logo_url IS NULL OR (carrier_logo_url ~* '^https://' AND char_length(carrier_logo_url) <= 600));
