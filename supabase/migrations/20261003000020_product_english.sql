-- English version of the product content (the interface language decides which one is shown)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS tags_en text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customization_options_en text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS certifications_en text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.products
  ADD CONSTRAINT products_name_en_len CHECK (name_en IS NULL OR length(name_en) <= 200),
  ADD CONSTRAINT products_description_en_len CHECK (description_en IS NULL OR length(description_en) <= 5000);
