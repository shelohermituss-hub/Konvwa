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

-- 9. installments: not callable anonymously; a shipped status is refused while installments are due
DO $$ DECLARE oid_ uuid; BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.start_installments(uuid,integer)', 'execute'), 'anon can start installments';
  ASSERT NOT has_function_privilege('anon', 'public.pay_next_installment(uuid)', 'execute'), 'anon can pay installments';
  SELECT id INTO oid_ FROM orders LIMIT 1;
  IF oid_ IS NOT NULL THEN
    UPDATE orders SET payment_status = 'partial', status = 'paid' WHERE id = oid_;
    BEGIN
      UPDATE orders SET status = 'shipped' WHERE id = oid_;
      RAISE EXCEPTION 'shipping allowed while installments are due';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE 'shipping allowed%' THEN RAISE; END IF;
    END;
  END IF;
END $$;

-- 10. resellers: a client cannot grant themselves the status nor see wholesale-only products
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); w uuid; n integer; BEGIN
  SELECT id INTO w FROM products WHERE active LIMIT 1;
  UPDATE products SET wholesale_only = true WHERE id = w;
  PERFORM pg_temp.as_user(a);
  UPDATE profiles SET is_reseller = true WHERE user_id = a;
  SELECT count(*) INTO n FROM products WHERE id = w;
  RESET ROLE;
  ASSERT (SELECT is_reseller FROM profiles WHERE user_id = a) = false, 'client could set is_reseller';
  ASSERT n = 0, 'client can see a wholesale-only product';
END $$;

-- 11. trust: insurance only through the function (debits the wallet, guard keeps columns), delivery options and photo RLS
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  rid uuid; w0 numeric; r jsonb; n integer; reg uuid; opt uuid; BEGIN
  INSERT INTO product_requests (user_id, request_type, status, product_name) VALUES (a, 'shipping', 'quoted', 'test insurance') RETURNING id INTO rid;
  UPDATE wallets SET available_balance = 100000 WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  UPDATE product_requests SET insured = true, insurance_fee_htg = 0 WHERE id = rid;
  RESET ROLE;
  ASSERT (SELECT insured FROM product_requests WHERE id = rid) = false, 'client could self-insure';
  PERFORM pg_temp.as_user(a);
  ASSERT (public.buy_shipping_insurance(rid, 50) ->> 'success')::boolean = false, 'value under minimum accepted';
  RESET ROLE;
  SELECT available_balance INTO w0 FROM wallets WHERE user_id = a;
  PERFORM pg_temp.as_user(b);
  ASSERT (public.buy_shipping_insurance(rid, 200) ->> 'success')::boolean = false, 'someone else insured the request';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  r := public.buy_shipping_insurance(rid, 200);
  RESET ROLE;
  ASSERT (r ->> 'success')::boolean, 'insurance purchase failed: ' || r::text;
  ASSERT (SELECT available_balance FROM wallets WHERE user_id = a) = w0 - (r ->> 'fee')::numeric, 'wallet not debited by the fee';
  PERFORM pg_temp.as_user(a);
  ASSERT (public.buy_shipping_insurance(rid, 200) ->> 'success')::boolean = false, 'double insurance accepted';
  RESET ROLE;

  SELECT id INTO reg FROM haiti_regions LIMIT 1;
  INSERT INTO delivery_options (region_id, kind, label, price_htg, active) VALUES (reg, 'pickup', 'test pickup', 100, false) RETURNING id INTO opt;
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM delivery_options WHERE id = opt;
  ASSERT n = 0, 'client sees an inactive delivery option';
  BEGIN
    INSERT INTO delivery_options (region_id, kind, label, price_htg) VALUES (reg, 'home', 'hack', 0);
    RAISE EXCEPTION 'client created a delivery option';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  INSERT INTO package_photos (request_id, path) VALUES (rid, rid::text || '/x.jpg');
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM package_photos WHERE request_id = rid;
  ASSERT n = 1, 'owner cannot see their package photo';
  RESET ROLE;
  PERFORM pg_temp.as_user(b);
  SELECT count(*) INTO n FROM package_photos WHERE request_id = rid;
  ASSERT n = 0, 'another client sees a package photo';
  ASSERT (public.admin_add_package_photo(rid, rid::text || '/y.jpg') ->> 'success')::boolean = false, 'client added a package photo';
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.buy_shipping_insurance(uuid,numeric)', 'execute'), 'anon can buy insurance';
END $$;

-- 12. loyalty: a client sees only their own tier, the internal function is not callable
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx); r jsonb; BEGIN
  PERFORM pg_temp.as_user(a);
  r := public.my_loyalty();
  ASSERT public.admin_customer_loyalty(b) IS NULL, 'client read another customer loyalty';
  RESET ROLE;
  ASSERT r ->> 'tier' IN ('bronze', 'silver', 'gold'), 'my_loyalty: ' || r::text;
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT public.admin_customer_loyalty(b) IS NOT NULL, 'admin cannot read loyalty';
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.my_loyalty()', 'execute'), 'anon can call my_loyalty';
  ASSERT NOT has_function_privilege('authenticated', 'public.loyalty_for(uuid)', 'execute'), 'clients can call loyalty_for';
END $$;

-- 13. uploads: a client can insert into every bucket they may write to (no policy recursion on storage.objects)
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); BEGIN
  PERFORM pg_temp.as_user(a);
  INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('avatars', a::text || '/avatar.jpg', a, '{}');
  INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('payment-proofs', a::text || '/p.jpg', a, '{}');
  INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('kyc-documents', a::text || '/k.jpg', a, '{}');
  RESET ROLE;
END $$;

-- 14. account setup: completion only through complete_onboarding(), which checks name, phone and notifications
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); r jsonb; BEGIN
  UPDATE profiles SET onboarding_completed_at = NULL, full_name = 'Test User', phone = NULL WHERE user_id = a;
  UPDATE push_subscriptions SET user_id = (SELECT admin_id FROM ctx) WHERE user_id = a;  -- the client has no push subscription
  PERFORM pg_temp.as_user(a);
  UPDATE profiles SET onboarding_completed_at = now() WHERE user_id = a;  -- guard trigger keeps the old value
  RESET ROLE;
  ASSERT (SELECT onboarding_completed_at FROM profiles WHERE user_id = a) IS NULL, 'client set onboarding_completed_at directly';
  PERFORM pg_temp.as_user(a);
  r := public.complete_onboarding('{}', true);
  ASSERT (r ->> 'success')::boolean = false AND r ->> 'code' = 'phone', 'completed without a phone: ' || r::text;
  RESET ROLE;
  UPDATE profiles SET phone = '+509 5562 6676' WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  r := public.complete_onboarding('{}', false);
  ASSERT (r ->> 'success')::boolean = false AND r ->> 'code' = 'notifications', 'completed without notifications: ' || r::text;
  r := public.complete_onboarding(ARRAY['mfa', 'bogus'], true);
  RESET ROLE;
  ASSERT (r ->> 'success')::boolean, 'completion failed: ' || r::text;
  ASSERT (SELECT onboarding_skipped FROM profiles WHERE user_id = a) = ARRAY['mfa'], 'unknown skipped items were stored';
  ASSERT NOT has_function_privilege('anon', 'public.complete_onboarding(text[],boolean)', 'execute'), 'anon can complete onboarding';
END $$;

-- 15. MFA scope: a client with MFA needs a fresh code for large top-ups (not for small ones); nothing is asked otherwise
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); w uuid; BEGIN
  SELECT id INTO w FROM wallets WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description) VALUES (w, 'deposit', 50000, 'pending', 'virement', 'no factor');
  RESET ROLE;
  INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) VALUES (gen_random_uuid(), a, 'totp', 'verified', now(), now());
  PERFORM pg_temp.as_user(a);
  BEGIN
    INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description) VALUES (w, 'deposit', 50000, 'pending', 'virement', 'no code');
    RAISE EXCEPTION 'large top-up accepted without a code';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description) VALUES (w, 'deposit', 500, 'pending', 'virement', 'small');
  ASSERT public.check_mfa(50000) = false, 'check_mfa should refuse without a recent code';
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.check_mfa(numeric)', 'execute'), 'anon can call check_mfa';
END $$;

-- 16. catalogue orders: shipping is fixed by the team on arrival, paid by the customer, and gates shipped/delivered
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  oid uuid; w uuid; w0 numeric; r jsonb; BEGIN
  SELECT id INTO w FROM wallets WHERE user_id = a;
  UPDATE wallets SET available_balance = 100000 WHERE id = w;
  INSERT INTO product_orders (user_id, total_htg, status, payment_status) VALUES (a, 1000, 'processing', 'paid') RETURNING id INTO oid;

  -- a client cannot mark the parcel as arrived, nor pay before it arrived
  PERFORM pg_temp.as_user(a);
  ASSERT (public.admin_product_order_received(oid, 0) ->> 'success')::boolean = false, 'client marked a parcel as arrived';
  ASSERT (public.pay_product_order_shipping(oid) ->> 'success')::boolean = false, 'paid shipping before the parcel arrived';
  RESET ROLE;

  -- the team marks it arrived with a shipping fee
  PERFORM pg_temp.as_user(adm, 'aal2');
  r := public.admin_product_order_received(oid, 2500, 'test');
  ASSERT (r ->> 'success')::boolean, 'arrival failed: ' || r::text;
  ASSERT (public.admin_product_order_received(oid, 2500) ->> 'success')::boolean = false, 'arrival accepted twice';
  RESET ROLE;

  -- not shippable while unpaid
  BEGIN
    UPDATE product_orders SET status = 'shipped' WHERE id = oid;
    RAISE EXCEPTION 'shipped while shipping unpaid';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- someone else cannot pay it; the owner pays once, the right amount
  PERFORM pg_temp.as_user(b);
  ASSERT (public.pay_product_order_shipping(oid) ->> 'success')::boolean = false, 'another client paid the shipping';
  RESET ROLE;
  SELECT available_balance INTO w0 FROM wallets WHERE id = w;
  PERFORM pg_temp.as_user(a);
  r := public.pay_product_order_shipping(oid);
  ASSERT (r ->> 'success')::boolean, 'shipping payment failed: ' || r::text;
  ASSERT (public.pay_product_order_shipping(oid) ->> 'success')::boolean = false, 'shipping paid twice';
  RESET ROLE;
  ASSERT (SELECT available_balance FROM wallets WHERE id = w) = w0 - 2500, 'wallet not debited by the shipping fee';
  UPDATE product_orders SET status = 'shipped' WHERE id = oid;  -- now allowed

  -- a client cannot edit the order
  PERFORM pg_temp.as_user(a);
  UPDATE product_orders SET shipping_amount_htg = 0, shipping_paid_at = NULL WHERE id = oid;
  RESET ROLE;
  ASSERT (SELECT shipping_amount_htg FROM product_orders WHERE id = oid) = 2500, 'client edited the shipping fee';
  ASSERT NOT has_function_privilege('anon', 'public.pay_product_order_shipping(uuid)', 'execute'), 'anon can pay shipping';
END $$;

SELECT 'all security tests passed' AS result;
ROLLBACK;
