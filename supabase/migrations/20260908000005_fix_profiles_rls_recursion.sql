-- Drop the recursive "Admins can read all profiles" policy on profiles.
-- That policy used SELECT 1 FROM profiles directly inside its USING clause,
-- causing infinite RLS recursion whenever an admin user fetched their own profile.
-- The existing users_read_own_profile policy already covers admins via is_admin()
-- which is SECURITY DEFINER and therefore bypasses RLS safely.
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
