-- Allow admins to insert notifications for any user
CREATE POLICY "Admins can insert any notification"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Allow admins to read all notifications
CREATE POLICY "Admins can read all notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Allow admins to update (mark read) any notification
CREATE POLICY "Admins can update any notification"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
