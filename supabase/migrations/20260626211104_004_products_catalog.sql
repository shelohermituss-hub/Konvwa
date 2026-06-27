-- Products catalog tables (Task 2)
-- Separate from the request-based product_requests flow

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  icon text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12, 2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Categories: anyone authenticated can read; only admins manage
CREATE POLICY "categories_auth_read" ON categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_admin_write" ON categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Products: authenticated users read active products; admins manage all
CREATE POLICY "products_auth_read" ON products
  FOR SELECT TO authenticated USING (is_active = true OR is_admin());

CREATE POLICY "products_admin_write" ON products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Seed categories
INSERT INTO categories (name, slug, icon) VALUES
  ('Électronique', 'electronics', 'Cpu'),
  ('Mode & Vêtements', 'fashion', 'Shirt'),
  ('Maison & Cuisine', 'home', 'Home'),
  ('Sport & Loisirs', 'sports', 'Dumbbell'),
  ('Beauté & Santé', 'beauty', 'Sparkles'),
  ('Jouets & Jeux', 'toys', 'Gamepad2')
ON CONFLICT (slug) DO NOTHING;
