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

-- 16. orders from the catalogue / with separate shipping: the team enters the real measures at the warehouse, the customer picks a method
--     (fees computed by the database) and pays -> "shipping_paid"; the team assigns the ORDER to an expedition (no cargo record),
--     the order follows the batch. Nothing leaves before the shipping is paid.
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  oid uuid; r jsonb; rate uuid; amt numeric; bal0 numeric; bal1 numeric; qid uuid; ord uuid; sid uuid; n integer; BEGIN
  UPDATE wallets SET available_balance = 1000000 WHERE user_id = a;
  INSERT INTO product_orders (user_id, total_htg, status, payment_status, tracking_status) VALUES (a, 1000, 'processing', 'paid', 'paid') RETURNING id INTO oid;
  INSERT INTO shipments (batch_code, status) VALUES ('TEST-' || substr(md5(random()::text), 1, 6), 'in_china_warehouse') RETURNING id INTO sid;

  PERFORM pg_temp.as_user(a);
  ASSERT (public.admin_order_arrived('product_order', oid, 5, 0.05) ->> 'success')::boolean = false, 'client declared an arrival';
  ASSERT (public.pay_order_shipping('product_order', oid, gen_random_uuid()) ->> 'success')::boolean = false, 'paid shipping before the arrival';
  RESET ROLE;
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_order_arrived('product_order', oid, 0, 0) ->> 'success')::boolean = false, 'arrival without measures accepted';
  ASSERT (public.admin_assign_order_to_batch('product_order', oid, sid) ->> 'success')::boolean = false, 'assigned before the shipping was paid';
  r := public.admin_order_arrived('product_order', oid, 10, 0.1);
  ASSERT (r ->> 'success')::boolean, 'arrival failed: ' || r::text;
  RESET ROLE;
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'in_china_warehouse', 'order not at the warehouse';
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = a AND link = '/product-orders/' || oid) >= 1, 'client not notified';

  PERFORM pg_temp.as_user(b);
  ASSERT (public.order_shipping_options('product_order', oid) ->> 'success')::boolean = false, 'another client reads the options';
  ASSERT (public.pay_order_shipping('product_order', oid, gen_random_uuid()) ->> 'success')::boolean = false, 'another client paid the shipping';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  r := public.order_shipping_options('product_order', oid);
  ASSERT (r ->> 'ready')::boolean AND jsonb_array_length(r -> 'options') > 0, 'no shipping option: ' || r::text;
  SELECT (o ->> 'rate_id')::uuid, (o ->> 'amount_htg')::numeric INTO rate, amt
    FROM jsonb_array_elements(r -> 'options') o ORDER BY (o ->> 'amount_htg')::numeric LIMIT 1;
  ASSERT amt > 0, 'zero fee';
  ASSERT (public.pay_order_shipping('product_order', oid, gen_random_uuid()) ->> 'success')::boolean = false, 'unknown rate accepted';
  SELECT available_balance INTO bal0 FROM wallets WHERE user_id = a;
  r := public.pay_order_shipping('product_order', oid, rate);
  ASSERT (r ->> 'success')::boolean, 'payment failed: ' || r::text;
  ASSERT (r ->> 'amount')::numeric = amt, 'charged amount differs from the computed fee';
  ASSERT (public.pay_order_shipping('product_order', oid, rate) ->> 'success')::boolean = false, 'shipping paid twice';
  SELECT available_balance INTO bal1 FROM wallets WHERE user_id = a;
  ASSERT bal0 - bal1 = amt, 'wallet debited ' || (bal0 - bal1) || ' instead of ' || amt;
  ASSERT (public.admin_assign_order_to_batch('product_order', oid, sid) ->> 'success')::boolean = false, 'client assigned an order to a batch';
  ASSERT (public.admin_set_product_order_status(oid, 'delivered') ->> 'success')::boolean = false, 'client set a catalogue order status';
  RESET ROLE;
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'shipping_paid', 'order not at shipping_paid';
  SELECT count(*) INTO n FROM product_requests WHERE source_order_id = oid;
  ASSERT n = 0, 'a cargo record was created for the order';

  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_assign_order_to_batch('product_order', oid, sid) ->> 'success')::boolean, 'team could not assign the order to a batch';
  RESET ROLE;
  ASSERT (SELECT shipment_id FROM product_orders WHERE id = oid) = sid, 'order not in the batch';
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'shipping_paid', 'batch not left yet but order moved';
  UPDATE shipments SET status = 'in_transit' WHERE id = sid;
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'in_transit', 'order did not follow the batch';
  ASSERT (SELECT status FROM product_orders WHERE id = oid) = 'shipped', 'order status did not mirror the tracking';
  UPDATE shipments SET status = 'delivered' WHERE id = sid;
  ASSERT (SELECT status FROM product_orders WHERE id = oid) = 'delivered', 'order not delivered with its batch';
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_set_product_order_status(oid, 'out_for_delivery') ->> 'success')::boolean, 'team could not set the status after payment';
  RESET ROLE;

  -- nothing leaves, nor is "shipping_paid" set by hand, before the shipping is paid
  INSERT INTO product_orders (user_id, total_htg, status, payment_status, tracking_status) VALUES (a, 10, 'processing', 'paid', 'in_china_warehouse') RETURNING id INTO ord;
  BEGIN
    UPDATE product_orders SET tracking_status = 'shipped' WHERE id = ord;
    ASSERT false, 'catalogue order shipped before the shipping was paid';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    UPDATE product_orders SET tracking_status = 'shipping_paid' WHERE id = ord;
    ASSERT false, 'shipping_paid set without payment';
  EXCEPTION WHEN raise_exception THEN NULL; END;

  -- separate-shipping order: same rules
  SELECT id INTO qid FROM quotes LIMIT 1;
  IF qid IS NOT NULL THEN
    INSERT INTO orders (user_id, quote_id, status, payment_status, shipping_option) VALUES (a, qid, 'purchasing', 'paid', 'separate') RETURNING id INTO ord;
    BEGIN
      UPDATE orders SET status = 'shipped' WHERE id = ord;
      ASSERT false, 'separate order shipped before the shipping was paid';
    EXCEPTION WHEN raise_exception THEN NULL; END;
    PERFORM pg_temp.as_user(adm, 'aal2');
    ASSERT (public.admin_order_arrived('order', ord, 3, 0.02) ->> 'success')::boolean, 'order arrival failed';
    RESET ROLE;
    PERFORM pg_temp.as_user(a);
    SELECT (o ->> 'rate_id')::uuid INTO rate FROM jsonb_array_elements(public.order_shipping_options('order', ord) -> 'options') o LIMIT 1;
    r := public.pay_order_shipping('order', ord, rate);
    ASSERT (r ->> 'success')::boolean, 'separate order payment failed: ' || r::text;
    RESET ROLE;
    ASSERT (SELECT status FROM orders WHERE id = ord) = 'shipping_paid', 'separate order not at shipping_paid';
    INSERT INTO shipments (batch_code, status) VALUES ('TEST-' || substr(md5(random()::text), 1, 6), 'in_china_warehouse') RETURNING id INTO sid;
    PERFORM pg_temp.as_user(adm, 'aal2');
    ASSERT (public.admin_assign_order_to_batch('order', ord, sid) ->> 'success')::boolean, 'team could not assign the separate order';
    RESET ROLE;
    UPDATE shipments SET status = 'customs_processing' WHERE id = sid;
    ASSERT (SELECT status FROM orders WHERE id = ord) = 'customs_processing', 'separate order did not follow its batch';
  END IF;

  ASSERT NOT has_function_privilege('authenticated', 'public.choose_shipping_method(uuid,uuid,numeric)', 'execute'), 'fee typed by the browser still accepted';
  ASSERT NOT has_function_privilege('authenticated', 'public.admin_product_order_received(uuid,uuid,text,integer,text)', 'execute'), 'legacy arrival still callable';
  ASSERT NOT has_function_privilege('authenticated', 'public.shipping_options_for(numeric,numeric,uuid)', 'execute'), 'internal fee grid callable';
END $$;

-- 17. simple shipping requests ("cargaisons"): a batch drives the paid ones; an unpaid one cannot leave; only the team writes tracking
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); sid uuid; rid uuid; BEGIN
  INSERT INTO shipments (batch_code, status) VALUES ('TEST-' || substr(md5(random()::text), 1, 6), 'in_china_warehouse') RETURNING id INTO sid;
  INSERT INTO product_requests (user_id, request_type, status, product_url, product_name, category, quantity, source_platform)
    VALUES (a, 'shipping', 'invoiced', '', 'test', 'other', 1, 'other') RETURNING id INTO rid;
  UPDATE product_requests SET shipment_id = sid WHERE id = rid;
  UPDATE shipments SET status = 'in_transit' WHERE id = sid;
  ASSERT (SELECT tracking_status FROM product_requests WHERE id = rid) = 'in_transit', 'cargo did not follow the batch';
  PERFORM pg_temp.as_user(a);
  UPDATE product_requests SET tracking_status = 'delivered' WHERE id = rid;  -- guard keeps the old value
  RESET ROLE;
  ASSERT (SELECT tracking_status FROM product_requests WHERE id = rid) = 'in_transit', 'client wrote tracking_status';
  BEGIN
    INSERT INTO product_requests (user_id, request_type, status, product_url, product_name, category, quantity, source_platform, tracking_status)
      VALUES (a, 'shipping', 'received', '', 'test', 'other', 1, 'other', 'shipped');
    ASSERT false, 'unpaid cargo could be shipped';
  EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;

-- 18. admin sidebar badges: counts only for staff
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx); BEGIN
  PERFORM pg_temp.as_user(a);
  ASSERT public.admin_badge_counts() = '{}'::jsonb, 'a client reads the admin counts';
  RESET ROLE;
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT public.admin_badge_counts() ? 'quotes', 'staff gets no counts';
  RESET ROLE;
END $$;

-- 19. user management: only staff set status / restrictions; restrictions and suspensions are enforced by the database
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  r jsonb; n integer; wid uuid; BEGIN
  UPDATE wallets SET available_balance = 500000 WHERE user_id = a;
  SELECT id INTO wid FROM wallets WHERE user_id = a;

  PERFORM pg_temp.as_user(a);
  UPDATE profiles SET account_status = 'banned', restrictions = '{}' WHERE user_id = a;
  ASSERT (SELECT account_status FROM profiles WHERE user_id = a) = 'active', 'client changed their status';
  SELECT count(*) INTO n FROM user_admin_notes; ASSERT n = 0, 'client reads notes';
  ASSERT (public.admin_set_user_access(b, 'banned', 'x') ->> 'success')::boolean = false, 'client banned someone';
  ASSERT public.admin_user_overview(b) = '{}'::jsonb, 'client reads overview';
  ASSERT NOT EXISTS (SELECT 1 FROM public.admin_list_users()), 'client lists users';
  ASSERT public.user_can('payments'), 'active client blocked';
  RESET ROLE;

  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_set_user_access(adm, 'suspended', 'x') ->> 'success')::boolean = false, 'admin suspended themselves';
  ASSERT (public.admin_set_user_access(a, 'suspended', '') ->> 'success')::boolean = false, 'suspension without reason';
  ASSERT (public.admin_set_user_access(a, 'weird', 'x') ->> 'success')::boolean = false, 'invalid status';
  ASSERT (public.admin_set_user_access(a, 'active', NULL, NULL, ARRAY['hack']) ->> 'success')::boolean = false, 'invalid restriction';
  ASSERT jsonb_typeof(public.admin_user_overview(a) -> 'profile') = 'object', 'no overview';
  ASSERT EXISTS (SELECT 1 FROM public.admin_list_users() WHERE user_id = a), 'user list empty';
  ASSERT (public.admin_set_user_access(a, 'active', NULL, NULL, ARRAY['payments']) ->> 'success')::boolean, 'restrict failed';
  RESET ROLE;

  PERFORM pg_temp.as_user(a);
  ASSERT NOT public.user_can('payments') AND public.user_can('requests'), 'restriction scope wrong';
  r := public.pay_product_order(gen_random_uuid());
  ASSERT (r ->> 'error') LIKE 'Cette action est restreinte%', 'payment not blocked: ' || r::text;
  RESET ROLE;

  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_set_user_access(a, 'suspended', 'Fraude suspectée', now() + interval '1 day', '{}') ->> 'success')::boolean, 'suspend failed';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  ASSERT NOT public.user_can('orders') AND NOT public.user_can('deposits') AND public.user_can('support'), 'suspended scope wrong';
  BEGIN
    INSERT INTO product_requests (user_id, product_url, product_name, category, quantity, source_platform) VALUES (a, 'https://x', 'x', 'other', 1, 'other');
    ASSERT false, 'suspended client created a request';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN
    INSERT INTO wallet_transactions (wallet_id, type, amount, status) VALUES (wid, 'deposit', 100, 'pending');
    ASSERT false, 'suspended client created a deposit';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  RESET ROLE;

  PERFORM pg_temp.as_user(adm, 'aal2');
  PERFORM public.admin_set_user_access(a, 'banned', 'Abus', NULL, '{}');
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  ASSERT NOT public.user_can('support'), 'banned can write to support';
  RESET ROLE;
  UPDATE profiles SET account_status = 'suspended', status_until = now() - interval '1 minute' WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  ASSERT public.user_can('orders'), 'expired suspension still blocks';
  RESET ROLE;

  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_set_user_access(a, 'active', NULL, NULL, '{}') ->> 'success')::boolean, 'reactivation failed';
  INSERT INTO user_admin_notes (user_id, note, updated_by) VALUES (a, 'client fiable', adm);
  ASSERT public.admin_user_overview(a) ->> 'note' = 'client fiable', 'note missing';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  ASSERT public.user_can('payments') AND public.user_can('orders'), 'not reactivated';
  RESET ROLE;
END $$;

-- 20. payment management: history / stats / manual wallet adjustment are staff-only; adjustments are checked and logged
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx); r jsonb; n integer; tot bigint; BEGIN
  UPDATE wallets SET available_balance = 1000 WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  ASSERT NOT EXISTS (SELECT 1 FROM public.admin_list_transactions()), 'client lists transactions';
  ASSERT public.admin_payment_stats() = '{}'::jsonb, 'client reads stats';
  ASSERT (public.admin_adjust_wallet(a, 500, 'test') ->> 'success')::boolean = false, 'client adjusted a wallet';
  RESET ROLE;
  PERFORM pg_temp.as_user(adm, 'aal2');
  SELECT count(*), max(total_count) INTO n, tot FROM public.admin_list_transactions('all', 'all', 'all', NULL, NULL, NULL, 5, 0);
  ASSERT n >= 1 AND tot >= n, 'no transactions';
  ASSERT jsonb_typeof(public.admin_payment_stats(NULL, NULL) -> 'by_method') = 'array', 'stats';
  ASSERT (public.admin_adjust_wallet(adm, 100, 'self') ->> 'success')::boolean = false, 'self adjustment';
  ASSERT (public.admin_adjust_wallet(a, 0, 'zero') ->> 'success')::boolean = false, 'zero amount';
  ASSERT (public.admin_adjust_wallet(a, 100, '') ->> 'success')::boolean = false, 'no reason';
  ASSERT (public.admin_adjust_wallet(a, -5000, 'too much') ->> 'success')::boolean = false, 'overdraft';
  r := public.admin_adjust_wallet(a, 700, 'Dépôt en espèces');
  ASSERT (r ->> 'success')::boolean AND (r ->> 'balance')::numeric = 1700, 'credit failed: ' || r::text;
  r := public.admin_adjust_wallet(a, -200, 'Correction');
  ASSERT (r ->> 'balance')::numeric = 1500, 'debit failed';
  RESET ROLE;
  ASSERT (SELECT available_balance FROM wallets WHERE user_id = a) = 1500, 'balance mismatch';
  ASSERT (SELECT count(*) FROM audit_logs WHERE action = 'wallet_adjustment') >= 2, 'adjustment not logged';
END $$;

-- 21. ad banners: clients only read live ads and never write; the team manages them; the media bucket is staff-write only
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx); n integer; live uuid; BEGIN
  PERFORM pg_temp.as_user(adm, 'aal2');
  INSERT INTO ad_banners (title, link_url, active) VALUES ('live', 'https://example.com', true) RETURNING id INTO live;
  INSERT INTO ad_banners (title, active) VALUES ('off', false);
  INSERT INTO ad_banners (title, starts_at) VALUES ('future', now() + interval '1 day');
  INSERT INTO ad_banners (title, ends_at) VALUES ('expired', now() - interval '1 day');
  INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('ads', 'test-ad.jpg', adm, '{}');
  BEGIN INSERT INTO ad_banners (title, link_url) VALUES ('bad', 'javascript:alert(1)'); RAISE EXCEPTION 'unsafe link accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT count(*) INTO n FROM ad_banners WHERE title IN ('live', 'off', 'future', 'expired'); ASSERT n = 4, 'staff does not see every ad';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  SELECT count(*) INTO n FROM ad_banners WHERE title IN ('live', 'off', 'future', 'expired'); ASSERT n = 1, 'client sees ' || n || ' ads instead of only the live one';
  UPDATE ad_banners SET title = 'hacked' WHERE id = live; GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'client updated an ad';
  BEGIN INSERT INTO ad_banners (title) VALUES ('client ad'); RAISE EXCEPTION 'client created an ad';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('ads', 'client.jpg', a, '{}'); RAISE EXCEPTION 'client uploaded to the ads bucket';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.ad_banners_touch()', 'execute'), 'trigger function callable';
  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ad_banners' AND 'anon' = ANY (roles)), 'anon can read ads';
END $$;

-- 22. product package data: the shipping estimate is staff-only and validated; products keep sane package/source values
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx); r jsonb; BEGIN
  PERFORM pg_temp.as_user(a);
  ASSERT (public.admin_product_shipping_estimate(1, 20, 15, 10, 1, 'generic') ->> 'success')::boolean = false, 'client got a shipping estimate';
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.admin_product_shipping_estimate(numeric,numeric,numeric,numeric,integer,text)', 'execute'), 'anon can call the estimate';
  PERFORM pg_temp.as_user(adm, 'aal2');
  r := public.admin_product_shipping_estimate(1.2, 30, 20, 15, 1, 'generic');
  ASSERT (r ->> 'success')::boolean AND jsonb_array_length(r -> 'options') > 0, 'admin estimate failed: ' || r::text;
  ASSERT (public.admin_product_shipping_estimate(-1, 1, 1, 1, 1, 'generic') ->> 'success')::boolean = false, 'negative weight accepted';
  ASSERT (public.admin_product_shipping_estimate(1, 1, 1, 1, 0, 'generic') ->> 'success')::boolean = false, 'zero quantity accepted';
  ASSERT (public.admin_product_shipping_estimate(NULL, NULL, NULL, NULL, 1, 'generic') -> 'options') = '[]'::jsonb, 'empty package gave options';
  RESET ROLE;
  BEGIN UPDATE products SET weight_kg = -2 WHERE id = (SELECT id FROM products LIMIT 1); RAISE EXCEPTION 'negative weight stored';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN UPDATE products SET source_url = 'javascript:alert(1)' WHERE id = (SELECT id FROM products LIMIT 1); RAISE EXCEPTION 'unsafe source url stored';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- 23. US catalogue products are sold all inclusive: shipping is computed by the database, added to the total, paid at once;
--     a mixed cart is split in two orders; the prepaid order skips the shipping payment and can then be assigned to a batch
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  us uuid; us_nopkg uuid; cn uuid; r jsonb; opt jsonb; rate uuid; ship numeric; oid uuid; cn_oid uuid; bal0 numeric; sid uuid; ords jsonb; n integer; BEGIN
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, supplier_name, active, stock_available, weight_kg, length_cm, width_cm, height_cm, brand)
    VALUES ('US test', 1000, 1, 'u', 'US', 'Amazon', true, true, 1.2, 30, 20, 15, 'Acme') RETURNING id INTO us;
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, supplier_name, active, stock_available)
    VALUES ('US no package', 500, 1, 'u', 'US', 'Amazon', true, true) RETURNING id INTO us_nopkg;
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, supplier_name, active, stock_available)
    VALUES ('CN test', 200, 1, 'u', 'CN', 'Alibaba', true, true) RETURNING id INTO cn;
  UPDATE wallets SET available_balance = 1000000 WHERE user_id = a;
  INSERT INTO shipments (batch_code, status) VALUES ('TEST-' || substr(md5(random()::text), 1, 6), 'in_china_warehouse') RETURNING id INTO sid;

  PERFORM pg_temp.as_user(a);
  r := public.checkout_shipping_options(jsonb_build_array(jsonb_build_object('product_id', us, 'quantity', 2)));
  ASSERT (r ->> 'success')::boolean AND (r ->> 'us_count')::int = 1 AND jsonb_array_length(r -> 'options') > 0, 'no checkout options: ' || r::text;
  ASSERT (r ->> 'kg')::numeric = 2.4, 'weight not summed: ' || r::text;
  rate := (r -> 'options' -> 0 ->> 'rate_id')::uuid; ship := (r -> 'options' -> 0 ->> 'amount_htg')::numeric;
  ASSERT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r -> 'options') o WHERE NOT public.rate_ships_from((o ->> 'rate_id')::uuid, 'US')), 'a non-US shipping method is offered for a US product';
  ASSERT (public.create_product_checkout(jsonb_build_array(jsonb_build_object('product_id', us, 'quantity', 1)), (SELECT sr.id FROM shipping_rates sr JOIN shipping_origins so ON so.id = sr.origin_id WHERE upper(so.country_code) <> 'US' LIMIT 1)) ->> 'success')::boolean = false, 'US product ordered with a non-US shipping method';
  ASSERT ship > 0, 'zero shipping';
  r := public.checkout_shipping_options(jsonb_build_array(jsonb_build_object('product_id', us_nopkg, 'quantity', 1)));
  ASSERT jsonb_array_length(r -> 'missing') = 1 AND jsonb_array_length(r -> 'options') = 0, 'product without package not flagged';
  ASSERT (public.create_product_checkout(jsonb_build_array(jsonb_build_object('product_id', us_nopkg, 'quantity', 1)), rate) ->> 'success')::boolean = false, 'ordered a US product without package';
  ASSERT (public.create_product_checkout(jsonb_build_array(jsonb_build_object('product_id', us, 'quantity', 2)), NULL) ->> 'success')::boolean = false, 'US order without a shipping method';
  ASSERT (public.create_product_checkout(jsonb_build_array(jsonb_build_object('product_id', us, 'quantity', 2)), gen_random_uuid()) ->> 'success')::boolean = false, 'unknown shipping method accepted';

  -- mixed cart: two orders, US one includes the shipping computed by the database
  r := public.create_product_checkout(jsonb_build_array(jsonb_build_object('product_id', us, 'quantity', 2), jsonb_build_object('product_id', cn, 'quantity', 3)), rate);
  ASSERT (r ->> 'success')::boolean, 'checkout failed: ' || r::text;
  ords := r -> 'orders'; ASSERT jsonb_array_length(ords) = 2, 'cart not split in two orders';
  oid := (SELECT (o ->> 'order_id')::uuid FROM jsonb_array_elements(ords) o WHERE (o ->> 'prepaid')::boolean);
  cn_oid := (SELECT (o ->> 'order_id')::uuid FROM jsonb_array_elements(ords) o WHERE NOT (o ->> 'prepaid')::boolean);
  ASSERT (SELECT total_htg FROM product_orders WHERE id = oid) = 2000 + ship, 'US order total is not products + shipping';
  ASSERT (SELECT total_htg FROM product_orders WHERE id = cn_oid) = 600, 'CN order must stay purchase only';
  ASSERT (SELECT shipping_prepaid FROM product_orders WHERE id = cn_oid) = false, 'CN order marked prepaid';
  BEGIN UPDATE product_orders SET shipping_prepaid = false, shipping_amount_htg = 1 WHERE id = oid; GET DIAGNOSTICS n = ROW_COUNT; ASSERT n = 0, 'client edited the order';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  SELECT available_balance INTO bal0 FROM wallets WHERE user_id = a;
  ASSERT (public.pay_product_order(oid) ->> 'success')::boolean, 'payment failed';
  ASSERT (SELECT available_balance FROM wallets WHERE user_id = a) = bal0 - (2000 + ship), 'wallet not debited products + shipping';
  RESET ROLE;
  ASSERT (SELECT shipping_paid_at FROM product_orders WHERE id = oid) IS NOT NULL, 'shipping not marked paid';
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'paid', 'tracking should start at paid';

  -- another client cannot pay it, and the shipping cannot be paid a second time
  PERFORM pg_temp.as_user(b);
  ASSERT (public.pay_product_order(oid) ->> 'success')::boolean = false, 'another client paid the order';
  RESET ROLE;
  PERFORM pg_temp.as_user(a);
  ASSERT (public.pay_order_shipping('product_order', oid, rate) ->> 'success')::boolean = false, 'shipping paid twice';
  RESET ROLE;

  -- warehouse arrival goes straight to "shipping paid", then the team assigns the batch
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_order_arrived('product_order', oid, 2.6, 0.0201) ->> 'success')::boolean, 'arrival of a prepaid order failed';
  ASSERT (public.admin_assign_order_to_batch('product_order', oid, sid) ->> 'success')::boolean, 'prepaid order not assignable';
  RESET ROLE;
  ASSERT (SELECT tracking_status FROM product_orders WHERE id = oid) = 'shipping_paid', 'prepaid order not at shipping_paid after arrival';
  ASSERT (SELECT shipment_id FROM product_orders WHERE id = oid) = sid, 'prepaid order not in the batch';
  ASSERT (SELECT count(*) FROM notifications WHERE user_id = a AND link = '/product-orders/' || oid AND title LIKE 'Votre colis est arrivé%') >= 1, 'no arrival notification';
  ASSERT NOT has_function_privilege('anon', 'public.create_product_checkout(jsonb,uuid,text)', 'execute'), 'anon can create a checkout';
  ASSERT NOT has_function_privilege('anon', 'public.checkout_shipping_options(jsonb)', 'execute'), 'anon can read checkout options';
  ASSERT NOT has_function_privilege('authenticated', 'public.package_shipping_options(numeric,numeric,uuid)', 'execute'), 'internal fee helper callable';
END $$;

-- 24. product variants: only staff write them; a product with variants cannot be ordered without a valid one;
--     the price comes from the variant (+ the same % as the quantity tier); the name is snapshotted; carts keep one line per variant
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  p uuid; p2 uuid; v1 uuid; v2 uuid; vx uuid; vo uuid; r jsonb; oid uuid; n integer; BEGIN
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, active, stock_available, price_tiers)
    VALUES ('Variant test', 1000, 1, 'u', 'CN', true, true, '[{"min_qty":10,"price_htg":800}]'::jsonb) RETURNING id INTO p;
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, active, stock_available)
    VALUES ('Other product', 300, 1, 'u', 'CN', true, true) RETURNING id INTO p2;

  -- a client cannot write variants, directly or through the staff function
  PERFORM pg_temp.as_user(a);
  BEGIN INSERT INTO product_variants (product_id, label, price_htg) VALUES (p, 'Hack', 1); ASSERT false, 'client inserted a variant';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  ASSERT (public.admin_save_product_variants(p, '[{"label":"Hack","price_htg":1}]'::jsonb) ->> 'success')::boolean = false, 'client saved variants';
  RESET ROLE;

  -- staff saves two variants (invalid ones are refused)
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_save_product_variants(p, '[{"label":"Bad","price_htg":0}]'::jsonb) ->> 'success')::boolean = false, 'zero price accepted';
  ASSERT (public.admin_save_product_variants(p, '[{"label":"Bad","price_htg":5,"image":"http://x.test/a.jpg"}]'::jsonb) ->> 'success')::boolean = false, 'non https image accepted';
  r := public.admin_save_product_variants(p, '[{"group_name":"Taille","label":"M","price_htg":1500,"image":"https://x.test/m.jpg"},{"group_name":"Taille","label":"L","price_htg":2000},{"label":"Rouge","price_htg":900,"stock_available":false}]'::jsonb);
  ASSERT (r ->> 'success')::boolean AND (r ->> 'count')::int = 3, 'staff could not save variants: ' || r::text;
  RESET ROLE;
  SELECT id INTO v1 FROM product_variants WHERE product_id = p AND label = 'M';
  SELECT id INTO v2 FROM product_variants WHERE product_id = p AND label = 'L';
  SELECT id INTO vx FROM product_variants WHERE product_id = p AND label = 'Rouge';
  INSERT INTO product_variants (product_id, label, price_htg) VALUES (p2, 'Foreign', 10) RETURNING id INTO vo;

  PERFORM pg_temp.as_user(a);
  ASSERT (SELECT count(*) FROM product_variants WHERE product_id = p) = 3, 'client cannot read the variants';
  BEGIN PERFORM public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1))); ASSERT false, 'ordered a product with variants without choosing one';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN PERFORM public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1, 'variant_id', vo))); ASSERT false, 'variant of another product accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN PERFORM public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1, 'variant_id', vx))); ASSERT false, 'out-of-stock variant accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;
  BEGIN PERFORM public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p2, 'quantity', 1, 'variant_id', v1))); ASSERT false, 'variant given to a product without variants';
  EXCEPTION WHEN raise_exception THEN NULL; END;

  -- price from the variant; quantity 10 hits the 800/1000 tier = 80 %
  r := public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 2, 'variant_id', v1), jsonb_build_object('product_id', p, 'quantity', 10, 'variant_id', v2)));
  ASSERT (r ->> 'success')::boolean, 'variant order failed: ' || r::text;
  oid := (r ->> 'order_id')::uuid;
  ASSERT (r ->> 'total')::numeric = 1500 * 2 + 2000 * 0.8 * 10, 'variant total wrong: ' || r::text;
  RESET ROLE;
  ASSERT (SELECT product_price_htg FROM product_order_items WHERE order_id = oid AND variant_id = v1) = 1500, 'variant price not used';
  ASSERT (SELECT product_price_htg FROM product_order_items WHERE order_id = oid AND variant_id = v2) = 1600, 'tier % not applied to the variant';
  ASSERT (SELECT variant_name FROM product_order_items WHERE order_id = oid AND variant_id = v1) = 'Taille : M', 'variant name not snapshotted';

  -- the snapshot survives a rename; removing a variant in the editor only switches it off
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_save_product_variants(p, jsonb_build_array(jsonb_build_object('id', v1, 'group_name', 'Taille', 'label', 'Medium', 'price_htg', 1500))) ->> 'success')::boolean, 'staff update failed';
  RESET ROLE;
  ASSERT (SELECT variant_name FROM product_order_items WHERE order_id = oid AND variant_id = v1) = 'Taille : M', 'snapshot changed with the variant';
  ASSERT (SELECT active FROM product_variants WHERE id = v2) = false, 'removed variant still active';
  PERFORM pg_temp.as_user(a);
  BEGIN PERFORM public.create_product_order(jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1, 'variant_id', v2))); ASSERT false, 'inactive variant accepted';
  EXCEPTION WHEN raise_exception THEN NULL; END;

  -- the cart holds one line per variant of the same product, but not twice the same one
  INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (a, p, v1, 1);
  INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (a, p, vx, 1);
  BEGIN INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES (a, p, v1, 1); ASSERT false, 'same variant twice in the cart';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO cart_items (user_id, product_id, quantity) VALUES (a, p2, 1);
  BEGIN INSERT INTO cart_items (user_id, product_id, quantity) VALUES (a, p2, 1); ASSERT false, 'same product without variant twice in the cart';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  RESET ROLE;
  ASSERT NOT has_function_privilege('anon', 'public.admin_save_product_variants(uuid,jsonb)', 'execute'), 'anon can save variants';
  ASSERT NOT has_function_privilege('public', 'public.admin_save_product_variants(uuid,jsonb)', 'execute'), 'PUBLIC can save variants';
END $$;

-- 25. gateway payments and proofs: a client cannot plant a MonCash deposit nor a proof id; a manual deposit is approved only with a proof
--     id that can be used once; gateway rows stay out of the admin queue; a checkout is ordered only when the gateway confirmed it
DO $$ DECLARE a uuid := (SELECT client_a FROM ctx); b uuid := (SELECT client_b FROM ctx); adm uuid := (SELECT admin_id FROM ctx);
  cn uuid; r jsonb; w uuid; bal0 numeric; t1 uuid; t2 uuid; t3 uuid; ref text; v_orders int; bal1 numeric; BEGIN
  INSERT INTO products (name, price_htg, moq, unit, supplier_country, active, stock_available) VALUES ('CN pay', 600, 1, 'u', 'CN', true, true) RETURNING id INTO cn;
  SELECT id INTO w FROM wallets WHERE user_id = a;
  SELECT available_balance INTO bal0 FROM wallets WHERE id = w;

  PERFORM pg_temp.as_user(a);
  BEGIN INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method) VALUES (w, 'deposit', 500, 'pending', 'moncash'); ASSERT false, 'client planted a moncash deposit';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  BEGIN INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, proof_id) VALUES (w, 'deposit', 500, 'pending', 'virement', 'FAKE-PROOF-1'); ASSERT false, 'client set a proof id';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN NULL; END;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, reference) VALUES (w, 'deposit', 500, 'pending', 'virement', 'VIR-1001') RETURNING id INTO t1;
  BEGIN INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, reference) VALUES (w, 'deposit', 700, 'pending', 'virement', ' vir-1001 '); ASSERT false, 'same reference twice';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, reference) VALUES (w, 'deposit', 800, 'pending', 'virement', 'VIR-1002') RETURNING id INTO t2;
  BEGIN PERFORM public.admin_approve_manual_deposit(t1, 'ABCD1234'); ASSERT false, 'client approved a deposit'; EXCEPTION WHEN raise_exception THEN NULL; END;
  RESET ROLE;

  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_approve_manual_deposit(t1, '  ') ->> 'success')::boolean = false, 'approved without proof id';
  ASSERT (public.admin_review_deposit(t1, true) ->> 'success')::boolean = false, 'old approve path still works';
  ASSERT (public.admin_approve_manual_deposit(t1, 'RECU-778899') ->> 'success')::boolean, 'approve failed';
  ASSERT (public.admin_approve_manual_deposit(t2, 'recu-778899') ->> 'code') = 'proof_reused', 'proof reused';
  ASSERT (public.admin_approve_manual_deposit(t1, 'RECU-778899') ->> 'success')::boolean = false, 'double approval';
  ASSERT (public.admin_review_deposit(t2, false) ->> 'success')::boolean, 'reject failed';
  RESET ROLE;
  ASSERT (SELECT available_balance FROM wallets WHERE id = w) = bal0 + 500, 'wallet not credited once';

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, reference, plop_transaction_id) VALUES (w, 'deposit', 900, 'pending', 'moncash', 'KW-TEST-1', 'p1') RETURNING id INTO t3;
  PERFORM pg_temp.as_user(adm, 'aal2');
  ASSERT (public.admin_review_deposit(t3, false) ->> 'success')::boolean = false, 'admin rejected a gateway deposit';
  ASSERT (public.admin_approve_manual_deposit(t3, 'GATEWAY-PROOF') ->> 'success')::boolean = false, 'admin approved a gateway deposit';
  ASSERT NOT EXISTS (SELECT 1 FROM public.admin_list_transactions('pending') x WHERE x.id = t3), 'gateway pending deposit in admin queue';
  ASSERT EXISTS (SELECT 1 FROM public.admin_list_transactions('all') x WHERE x.id = t3), 'gateway deposit missing from history';
  RESET ROLE;

  SELECT count(*) INTO v_orders FROM product_orders WHERE user_id = a;
  PERFORM pg_temp.as_user(a);
  r := public.quote_checkout(jsonb_build_array(jsonb_build_object('product_id', cn, 'quantity', 2)), NULL);
  ASSERT (r ->> 'success')::boolean AND (r ->> 'total')::numeric = 1200, 'quote wrong: ' || r::text;
  r := public.quote_checkout(jsonb_build_array(jsonb_build_object('product_id', gen_random_uuid(), 'quantity', 2)), NULL);
  ASSERT (r ->> 'success')::boolean = false, 'quote of an unknown product ok';
  BEGIN PERFORM public.fulfill_checkout_intent('x'); ASSERT false, 'client called fulfill'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  ASSERT (SELECT count(*) FROM product_orders WHERE user_id = a) = v_orders, 'quote left orders behind';

  ref := 'KW-TESTINT-1';
  INSERT INTO checkout_intents (user_id, reference, method, amount, items, source) VALUES (a, ref, 'moncash', 1200, jsonb_build_array(jsonb_build_object('product_id', cn, 'quantity', 2)), 'cart');
  SELECT available_balance INTO bal1 FROM wallets WHERE id = w;
  r := public.fulfill_checkout_intent(ref);
  ASSERT (r ->> 'success')::boolean, 'fulfil failed: ' || r::text;
  ASSERT (SELECT available_balance FROM wallets WHERE id = w) = bal1, 'wallet should end unchanged (credited then paid)';
  ASSERT (SELECT count(*) FROM product_orders WHERE user_id = a AND payment_status = 'paid') >= 1, 'order not paid';
  ASSERT (SELECT status FROM checkout_intents WHERE reference = ref) = 'completed', 'intent not completed';
  r := public.fulfill_checkout_intent(ref);
  ASSERT (r ->> 'already')::boolean, 'second fulfil not idempotent';
  ASSERT (SELECT count(*) FROM wallet_transactions WHERE reference = ref) = 1, 'credited twice';

  UPDATE products SET active = false WHERE id = cn;
  INSERT INTO checkout_intents (user_id, reference, method, amount, items) VALUES (a, 'KW-TESTINT-2', 'natcash', 1200, jsonb_build_array(jsonb_build_object('product_id', cn, 'quantity', 2)));
  SELECT available_balance INTO bal1 FROM wallets WHERE id = w;
  r := public.fulfill_checkout_intent('KW-TESTINT-2');
  ASSERT (r ->> 'success')::boolean = false AND (r ->> 'credited')::numeric = 1200, 'failed fulfil not reported: ' || r::text;
  ASSERT (SELECT available_balance FROM wallets WHERE id = w) = bal1 + 1200, 'money lost on failed order';
  ASSERT (SELECT status FROM checkout_intents WHERE reference = 'KW-TESTINT-2') = 'order_failed', 'intent status';

  PERFORM pg_temp.as_user(b);
  ASSERT (SELECT count(*) FROM checkout_intents) = 0, 'client b reads intents';
  RESET ROLE;
END $$;

SELECT 'all security tests passed' AS result;
ROLLBACK;
