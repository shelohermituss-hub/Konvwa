/*
# Initial Schema for Haiti Import Platform

1. New Tables
- `profiles`: User profiles with role-based access (client, agent, manager, admin)
- `wallets`: User wallets with available and blocked balances
- `wallet_transactions`: Transaction history for wallet operations
- `product_requests`: Product submission requests from clients
- `quotes`: Detailed quotes for product requests
- `orders`: Orders created from accepted quotes
- `suppliers`: Supplier management with trust scores
- `shipments`: Shipment tracking for orders
- `notifications`: In-app notifications for users

2. Security
- Enable RLS on all tables
- Owner-scoped policies for client data (profiles, wallets, orders, etc.)
- Admin-only access for supplier management
- Authenticated users can only access their own data

3. Notes
- Uses Supabase auth.users as the base for user identity
- All tables have uuid primary keys with gen_random_uuid()
- Timestamps for created_at and updated_at where relevant
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'agent', 'manager', 'admin')),
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance numeric(12, 2) NOT NULL DEFAULT 0,
  blocked_balance numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'payment', 'refund', 'block', 'unblock')),
  amount numeric(12, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  reference text,
  payment_method text CHECK (payment_method IN ('moncash', 'natcash', 'wallet')),
  description text,
  created_at timestamptz DEFAULT now()
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  phone text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Product requests table
CREATE TABLE IF NOT EXISTS product_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_url text NOT NULL,
  product_name text NOT NULL,
  category text,
  quantity integer NOT NULL DEFAULT 1,
  variant_info jsonb,
  budget_estimate numeric(12, 2),
  urgency text CHECK (urgency IN ('normal', 'urgent', 'express')),
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'reviewing', 'quoted', 'rejected')),
  source_platform text CHECK (source_platform IN ('alibaba', 'shein', 'temu', 'other')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES product_requests(id) ON DELETE CASCADE,
  product_price numeric(12, 2) NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  service_fee numeric(12, 2) NOT NULL DEFAULT 0,
  purchase_fee numeric(12, 2) NOT NULL DEFAULT 0,
  shipping_fee numeric(12, 2) NOT NULL DEFAULT 0,
  customs_fee numeric(12, 2) NOT NULL DEFAULT 0,
  local_delivery_fee numeric(12, 2) NOT NULL DEFAULT 0,
  margin numeric(12, 2) NOT NULL DEFAULT 0,
  contingency numeric(12, 2) NOT NULL DEFAULT 0,
  total numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'HTG',
  estimated_delivery_days integer,
  supplier_risk_level text CHECK (supplier_risk_level IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  valid_until timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  source_platform text NOT NULL CHECK (source_platform IN ('alibaba', 'shein', 'temu', 'other')),
  supplier_url text,
  country text,
  categories text[],
  moq integer DEFAULT 1,
  average_production_days integer,
  average_delivery_days integer,
  trust_score integer DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  verification_status text DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'basic', 'verified', 'premium')),
  response_rate numeric(5, 2),
  on_time_delivery_rate numeric(5, 2),
  quality_rating numeric(5, 2),
  dispute_count integer DEFAULT 0,
  total_orders integer DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES quotes(id),
  tracking_code text UNIQUE NOT NULL DEFAULT 'ORD-' || upper(substr(md5(random()::text), 1, 8)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'quote_sent', 'quote_accepted', 'awaiting_payment',
    'paid', 'purchasing', 'in_china_warehouse', 'shipped',
    'in_transit', 'arrived_haiti', 'customs_processing',
    'out_for_delivery', 'delivered', 'closed', 'cancelled'
  )),
  total_paid numeric(12, 2) NOT NULL DEFAULT 0,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Shipments table
CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code text UNIQUE NOT NULL DEFAULT 'SHP-' || upper(substr(md5(random()::text), 1, 8)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'consolidating', 'packed', 'loaded',
    'sailing', 'arrived', 'cleared', 'distributing', 'completed'
  )),
  vessel_info text,
  departure_date date,
  estimated_arrival date,
  actual_arrival date,
  container_number text,
  weight_kg numeric(10, 2),
  volume_m3 numeric(10, 2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order shipments junction table
CREATE TABLE IF NOT EXISTS order_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id, shipment_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('info', 'success', 'warning', 'error')),
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Support messages table
CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  attachments jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles policies
DROP POLICY IF EXISTS "users_read_own_profile" ON profiles;
CREATE POLICY "users_read_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- Wallets policies
DROP POLICY IF EXISTS "users_read_own_wallet" ON wallets;
CREATE POLICY "users_read_own_wallet" ON wallets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_wallet" ON wallets;
CREATE POLICY "users_insert_own_wallet" ON wallets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_wallet" ON wallets;
CREATE POLICY "users_update_own_wallet" ON wallets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- Wallet transactions policies
DROP POLICY IF EXISTS "users_read_own_transactions" ON wallet_transactions;
CREATE POLICY "users_read_own_transactions" ON wallet_transactions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_transactions" ON wallet_transactions;
CREATE POLICY "users_insert_own_transactions" ON wallet_transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  );

-- Addresses policies
DROP POLICY IF EXISTS "users_crud_own_addresses" ON addresses;
CREATE POLICY "users_crud_own_addresses" ON addresses FOR ALL
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- Product requests policies
DROP POLICY IF EXISTS "users_read_own_requests" ON product_requests;
CREATE POLICY "users_read_own_requests" ON product_requests FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_requests" ON product_requests;
CREATE POLICY "users_insert_own_requests" ON product_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_requests" ON product_requests;
CREATE POLICY "users_update_own_requests" ON product_requests FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- Quotes policies
DROP POLICY IF EXISTS "users_read_own_quotes" ON quotes;
CREATE POLICY "users_read_own_quotes" ON quotes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM product_requests WHERE product_requests.id = quotes.request_id AND product_requests.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "admin_manage_quotes" ON quotes;
CREATE POLICY "admin_manage_quotes" ON quotes FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Orders policies
DROP POLICY IF EXISTS "users_read_own_orders" ON orders;
CREATE POLICY "users_read_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_orders" ON orders;
CREATE POLICY "users_insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_orders" ON orders;
CREATE POLICY "users_update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (is_admin());

-- Order status history policies
DROP POLICY IF EXISTS "users_read_own_order_history" ON order_status_history;
CREATE POLICY "users_read_own_order_history" ON order_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "admin_insert_order_history" ON order_status_history;
CREATE POLICY "admin_insert_order_history" ON order_status_history FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- Suppliers policies (admin only)
DROP POLICY IF EXISTS "admin_manage_suppliers" ON suppliers;
CREATE POLICY "admin_manage_suppliers" ON suppliers FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users_read_suppliers" ON suppliers;
CREATE POLICY "users_read_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (true);

-- Shipments policies
DROP POLICY IF EXISTS "admin_manage_shipments" ON shipments;
CREATE POLICY "admin_manage_shipments" ON shipments FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "users_read_own_shipments" ON order_shipments;
CREATE POLICY "users_read_own_shipments" ON order_shipments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_shipments.order_id AND orders.user_id = auth.uid())
    OR is_admin()
  );

-- Notifications policies
DROP POLICY IF EXISTS "users_read_own_notifications" ON notifications;
CREATE POLICY "users_read_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
CREATE POLICY "users_update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_insert_notifications" ON notifications;
CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- Support tickets policies
DROP POLICY IF EXISTS "users_read_own_tickets" ON support_tickets;
CREATE POLICY "users_read_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "users_insert_own_tickets" ON support_tickets;
CREATE POLICY "users_insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_tickets" ON support_tickets;
CREATE POLICY "users_update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (is_admin());

-- Support messages policies
DROP POLICY IF EXISTS "users_read_own_messages" ON support_messages;
CREATE POLICY "users_read_own_messages" ON support_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid())
    OR is_admin()
  );

DROP POLICY IF EXISTS "users_insert_own_messages" ON support_messages;
CREATE POLICY "users_insert_own_messages" ON support_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND (support_tickets.user_id = auth.uid() OR is_admin()))
  );

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_product_requests_user_id ON product_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
