-- Security regression tests. Run in the Supabase SQL editor (or execute_sql): everything is rolled back.
-- Any failed ASSERT stops the script with its message. Needs at least 1 admin and 2 clients that have a wallet.
BEGIN;

CREATE TEMP TABLE ctx AS
SELECT
  (SELECT user_id FROM profiles WHERE role = 'admin' LIMIT 1) AS admin_id,
  (SELECT p.user_id FROM profiles p JOIN wallets w ON w.user_id = p.user_id WHERE p.role = 'client' ORDER BY p.created_at LIMIT 1) AS client_a,
  (SELECT p.user_id FROM profiles p JOIN wallets w ON w.user_id = p.user_id WHERE p.role = 'client' ORDER BY p.created_at OFFSET 1 LIMIT 1) AS client_b;
GRANT SELECT ON ctx TO authenticated;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid uuid, p_aal text DEFAULT 'aal1') RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  SET LOCAL ROLE authenticated;
END $$;

-- 1. rate limiter: 3 calls allowed, then refused
DO $$ DECLARE r boolean[]; BEGIN
  SELECT array_agg(public.check_rate_limit('test:rl', 3, 60)) INTO r FROM generate_series(1, 5);
  ASSERT r = ARRAY[true, true, true, false, false], 'rate limit: ' || r::text;
END $$;

-- 2. login lockout after 5 failures
DO $$ BEGIN
  PERFORM public.record_login_failure('lock@test.dev') FROM generate_series(1, 5);
  ASSERT public.login_lock_seconds('LOCK@test.dev ') > 0, 'login lockout not applied';
END $$;

-- 3. a client can only see their own wallet, cannot edit it, cannot become admin
DO $$ DECLARE n integer; a uuid := (SELECT client_a FROM ctx); BEGIN
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM wallets;
  ASSERT n = 1, 'client sees ' || n || ' wallets';
  BEGIN
    UPDATE wallets SET available_balance = available_balance + 1000000 WHERE user_id = a;
    GET DIAGNOSTICS n = ROW_COUNT;
    ASSERT n = 0, 'client could update their own balance';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE profiles SET role = 'admin' WHERE user_id = a;  -- the guard trigger silently keeps the old role
  RESET ROLE;
  ASSERT (SELECT role FROM profiles WHERE user_id = a) = 'client', 'client could change their own role';
END $$;

-- 4. refunds: only a full admin, needs a reason, never twice
DO $$ DECLARE r jsonb; tx uuid; adm uuid := (SELECT admin_id FROM ctx); cl uuid := (SELECT client_a FROM ctx); BEGIN
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description)
  SELECT id, 'payment', 100, 'completed', 'wallet', 'test payment' FROM wallets WHERE user_id = cl RETURNING id INTO tx;
  PERFORM pg_temp.as_user(cl);
  ASSERT (public.admin_refund_transaction(tx, 'x') ->> 'success')::boolean = false, 'client could refund';
  RESET ROLE;
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_refund_transaction(tx, ' ') ->> 'success')::boolean = false, 'refund without reason accepted';
  ASSERT (public.admin_refund_transaction(tx, 'test') ->> 'success')::boolean = true, 'refund failed';
  ASSERT (public.admin_refund_transaction(tx, 'test') ->> 'success')::boolean = false, 'double refund accepted';
  RESET ROLE;
END $$;

-- 5. staff MFA: with the rule on, an admin without aal2 is not an admin
DO $$ DECLARE adm uuid := (SELECT admin_id FROM ctx); was text; ok1 boolean; ok2 boolean; BEGIN
  SELECT value INTO was FROM app_settings WHERE key = 'staff_mfa_required';
  UPDATE app_settings SET value = 'true' WHERE key = 'staff_mfa_required';
  PERFORM pg_temp.as_user(adm, 'aal1'); ok1 := public.is_admin(); RESET ROLE;
  PERFORM pg_temp.as_user(adm, 'aal2'); ok2 := public.is_admin(); RESET ROLE;
  UPDATE app_settings SET value = was WHERE key = 'staff_mfa_required';
  ASSERT ok1 = false AND ok2 = true, 'MFA rule: aal1=' || ok1 || ' aal2=' || ok2;
END $$;

-- 6. support: a sender cannot be spoofed
DO $$ DECLARE cl uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx); t uuid := gen_random_uuid(); BEGIN
  PERFORM pg_temp.as_user(cl);
  INSERT INTO support_tickets (id, user_id, subject, status) VALUES (t, cl, 'test', 'open');
  BEGIN
    INSERT INTO support_messages (ticket_id, sender_id, message) VALUES (t, adm, 'spoof');
    RAISE EXCEPTION 'spoofed sender accepted';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  RESET ROLE;
END $$;

-- 7. promo codes: one use per client, limit respected, list hidden from clients
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); n integer; BEGIN
  INSERT INTO promo_codes (code, credit_htg, max_uses) VALUES ('TESTSEC', 50, 1);
  PERFORM pg_temp.as_user(a);
  ASSERT (public.redeem_promo_code('testsec') ->> 'success')::boolean, 'promo redeem failed';
  SELECT count(*) INTO n FROM promo_codes;
  ASSERT n = 0, 'client can list promo codes';
  RESET ROLE;
  PERFORM pg_temp.as_user(b);
  ASSERT (public.redeem_promo_code('TESTSEC') ->> 'success')::boolean = false, 'promo limit not enforced';
  RESET ROLE;
END $$;

-- 8. money functions are not callable by anonymous users
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.pay_order(uuid)', 'execute'), 'anon can call pay_order';
  ASSERT NOT has_function_privilege('anon', 'public.admin_refund_transaction(uuid,text)', 'execute'), 'anon can call refund';
  ASSERT NOT has_function_privilege('authenticated', 'public.check_rate_limit(text,integer,integer)', 'execute'), 'clients can call check_rate_limit';
  ASSERT NOT has_function_privilege('authenticated', 'public.mfa_ok(numeric)', 'execute'), 'clients can call mfa_ok';
END $$;

SELECT 'all security tests passed' AS result;
ROLLBACK;
