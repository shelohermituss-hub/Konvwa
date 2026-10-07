-- Two shelves: finished products sold by the unit to end customers ('retail': Amazon, Shein, Temu...) and sourcing
-- products sold in bulk with a minimum order quantity ('wholesale': Alibaba...). Not to be confused with products.wholesale_only,
-- which hides a product from everyone but approved resellers.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'retail';
ALTER TABLE public.products ADD CONSTRAINT products_sale_type_check CHECK (sale_type IN ('retail', 'wholesale'));
CREATE INDEX IF NOT EXISTS idx_products_sale_type ON public.products (sale_type) WHERE active;

-- Existing products: Alibaba, or a minimum order of 10 and more, are sourcing; the team can correct each one afterwards
UPDATE public.products SET sale_type = 'wholesale' WHERE supplier_name ILIKE 'alibaba%' OR moq >= 10;
