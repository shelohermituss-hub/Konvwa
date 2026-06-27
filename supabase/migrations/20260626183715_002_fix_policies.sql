-- Allow users to delete their own notifications
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
CREATE POLICY "users_delete_own_notifications" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Allow users to insert their own notifications (for self-triggered events)
DROP POLICY IF EXISTS "users_insert_own_notifications" ON notifications;
CREATE POLICY "users_insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR is_admin());

-- Allow users to accept/reject their own quotes
DROP POLICY IF EXISTS "users_update_own_quotes" ON quotes;
CREATE POLICY "users_update_own_quotes" ON quotes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_requests
      WHERE product_requests.id = quotes.request_id
        AND product_requests.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_requests
      WHERE product_requests.id = quotes.request_id
        AND product_requests.user_id = auth.uid()
    )
  );

-- Allow authenticated users to read shipments (they need to see their batch info)
DROP POLICY IF EXISTS "users_read_shipments" ON shipments;
CREATE POLICY "users_read_shipments" ON shipments FOR SELECT
  TO authenticated USING (true);

-- Allow users to read order_shipments for their orders
DROP POLICY IF EXISTS "admin_manage_shipments_junction" ON order_shipments;
CREATE POLICY "admin_manage_shipments_junction" ON order_shipments FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Allow admins to insert/update orders (for status management)
DROP POLICY IF EXISTS "admin_manage_orders" ON orders;
CREATE POLICY "admin_manage_orders" ON orders FOR ALL
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
