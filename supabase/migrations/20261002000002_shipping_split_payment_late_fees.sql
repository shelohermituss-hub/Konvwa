-- ============================================================
-- KONVWA — Shipping quote: pay 50 % now / 50 % at delivery,
-- 10-day payment deadline, 500 HTG/day late fee, reminders.
--
-- Flow: ... received -> quoted (official quote) -> invoiced (paid)
--                                              \-> deposit_paid (50 %) -> invoiced (balance paid)
-- ============================================================

-- ── 1. Settings (editable in app_settings) ───────────────────
INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('shipping_payment_deadline_days', '10',  'Délai de paiement du devis d''expédition (jours)',
   'Jours accordés au client pour régler le devis, comptés depuis l''envoi du devis (après arrivée des colis à l''entrepôt).', false),
  ('shipping_late_fee_per_day_htg',  '500', 'Frais de retard par jour (HTG)',
   'Montant ajouté automatiquement au devis pour chaque jour de retard commencé après l''échéance.', false),
  ('shipping_deposit_percent',       '50',  'Acompte expédition (%)',
   'Part du devis payable maintenant ; le reste est payé à la livraison.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION shipping_terms(OUT deadline_days integer, OUT late_fee_htg numeric, OUT deposit_pct numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT value::integer FROM app_settings WHERE key = 'shipping_payment_deadline_days'), 10),
    COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'shipping_late_fee_per_day_htg'), 500),
    COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'shipping_deposit_percent'), 50);
$$;

-- Every started day after the deadline counts as one late day
CREATE OR REPLACE FUNCTION shipping_late_days(p_due timestamptz)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_due IS NULL OR now() <= p_due THEN 0
    ELSE ceil(extract(epoch FROM (now() - p_due)) / 86400)::integer
  END;
$$;

-- ── 2. Columns + new status ──────────────────────────────────
ALTER TABLE product_requests
  ADD COLUMN IF NOT EXISTS payment_plan     text          NOT NULL DEFAULT 'full' CHECK (payment_plan IN ('full', 'half')),
  ADD COLUMN IF NOT EXISTS paid_amount_htg  numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_htg     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_due_at   timestamptz,
  ADD COLUMN IF NOT EXISTS balance_paid_at  timestamptz;

ALTER TABLE product_requests DROP CONSTRAINT IF EXISTS product_requests_status_check;
ALTER TABLE product_requests ADD CONSTRAINT product_requests_status_check
  CHECK (status IN ('draft', 'submitted', 'reviewing', 'quoted', 'rejected',
                    'received', 'deposit_paid', 'invoiced', 'cancelled'));

-- ── 3. Payment due date: both "packages received" and "quote sent", then +10 days
CREATE OR REPLACE FUNCTION set_shipping_payment_due()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_days integer;
BEGIN
  IF NEW.request_type <> 'shipping' OR NEW.quoted_at IS NULL OR NEW.received_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.payment_due_at IS NULL
     OR NEW.quoted_at   IS DISTINCT FROM OLD.quoted_at
     OR NEW.received_at IS DISTINCT FROM OLD.received_at THEN
    SELECT deadline_days INTO v_days FROM shipping_terms();
    NEW.payment_due_at := GREATEST(NEW.quoted_at, NEW.received_at) + make_interval(days => v_days);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_shipping_payment_due ON product_requests;
CREATE TRIGGER trg_set_shipping_payment_due
  BEFORE INSERT OR UPDATE ON product_requests
  FOR EACH ROW EXECUTE FUNCTION set_shipping_payment_due();

-- Quotes already waiting for payment get a fresh 10-day grace period (no retroactive fees)
UPDATE product_requests
   SET payment_due_at = now() + make_interval(days => (SELECT deadline_days FROM shipping_terms()))
 WHERE request_type = 'shipping' AND status = 'quoted' AND payment_due_at IS NULL;

-- ── 4. Payment summary used by the app ───────────────────────
CREATE OR REPLACE FUNCTION shipping_payment_summary(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         product_requests%ROWTYPE;
  t         record;
  v_quote   numeric;
  v_late    integer;
  v_fee     numeric;
  v_deposit numeric;
BEGIN
  SELECT * INTO r FROM product_requests WHERE id = p_request_id AND request_type = 'shipping';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF r.user_id <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;

  SELECT * INTO t FROM shipping_terms();
  v_quote := COALESCE(r.quoted_amount_htg, 0);

  IF r.status = 'quoted' THEN
    v_late := shipping_late_days(r.payment_due_at);
    v_fee  := v_late * t.late_fee_htg;
  ELSE
    v_late := 0;
    v_fee  := COALESCE(r.late_fee_htg, 0);
  END IF;

  v_deposit := ceil(v_quote * t.deposit_pct / 100);

  RETURN jsonb_build_object(
    'success', true,
    'status', r.status,
    'plan', r.payment_plan,
    'quote', v_quote,
    'due_at', r.payment_due_at,
    'deadline_days', t.deadline_days,
    'late_days', v_late,
    'late_fee', v_fee,
    'late_fee_per_day', t.late_fee_htg,
    'deposit_pct', t.deposit_pct,
    'deposit', v_deposit,
    'full_due', v_quote + v_fee,
    'deposit_due', v_deposit + v_fee,
    'balance_after_deposit', v_quote - v_deposit,
    'paid', COALESCE(r.paid_amount_htg, 0),
    'balance_remaining', GREATEST(v_quote - COALESCE(r.paid_amount_htg, 0), 0)
  );
END;
$$;

-- ── 5. Client pays the quote: in full or 50 % now ────────────
CREATE OR REPLACE FUNCTION pay_shipping_quote(p_request_id uuid, p_plan text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         product_requests%ROWTYPE;
  t         record;
  v_wallet  uuid;
  v_balance numeric;
  v_quote   numeric;
  v_fee     numeric;
  v_base    numeric;
  v_charge  numeric;
  v_label   text;
  v_code    text := upper(left(p_request_id::text, 8));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.');
  END IF;
  IF p_plan NOT IN ('full', 'half') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mode de paiement invalide.');
  END IF;

  SELECT * INTO r FROM product_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF r.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorisé.');
  END IF;
  IF r.request_type <> 'shipping' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de demande invalide.');
  END IF;
  IF r.status <> 'quoted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce devis n''est plus à régler.');
  END IF;
  IF r.quoted_amount_htg IS NULL OR r.quoted_amount_htg <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Montant du devis introuvable.');
  END IF;

  SELECT * INTO t FROM shipping_terms();
  v_quote  := r.quoted_amount_htg;
  v_fee    := shipping_late_days(r.payment_due_at) * t.late_fee_htg;
  v_base   := CASE WHEN p_plan = 'half' THEN ceil(v_quote * t.deposit_pct / 100) ELSE v_quote END;
  v_charge := v_base + v_fee;

  SELECT id, available_balance INTO v_wallet, v_balance
    FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
  END IF;
  IF v_balance < v_charge THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible, '
               || to_char(v_charge, 'FM999,999,990') || ' HTG requis).');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_charge, updated_at = now() WHERE id = v_wallet;

  v_label := CASE WHEN p_plan = 'half'
                  THEN 'Frais d''expédition — acompte ' || t.deposit_pct::integer || ' % — demande #' || v_code
                  ELSE 'Frais d''expédition — demande #' || v_code END;
  IF v_fee > 0 THEN
    v_label := v_label || ' (dont ' || to_char(v_fee, 'FM999,999,990') || ' HTG de frais de retard)';
  END IF;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', v_charge, 'completed', v_label);

  UPDATE product_requests SET
    payment_plan      = p_plan,
    paid_amount_htg   = v_base,
    late_fee_htg      = v_fee,
    actual_amount_htg = v_quote + v_fee,
    status            = CASE WHEN p_plan = 'half' THEN 'deposit_paid' ELSE 'invoiced' END,
    invoiced_at       = CASE WHEN p_plan = 'half' THEN NULL ELSE now() END,
    updated_at        = now()
  WHERE id = p_request_id;

  IF p_plan = 'half' THEN
    PERFORM notify_once(
      r.user_id, 'success', 'Acompte reçu — expédition #' || v_code,
      'Nous avons reçu ' || to_char(v_charge, 'FM999,999,990') || ' HTG. Il reste '
        || to_char(v_quote - v_base, 'FM999,999,990') || ' HTG à régler à la livraison.',
      '/shipments/' || p_request_id, jsonb_build_object('request_id', p_request_id)
    );
  ELSE
    PERFORM notify_once(
      r.user_id, 'success', 'Paiement confirmé — expédition #' || v_code,
      'Votre paiement de ' || to_char(v_charge, 'FM999,999,990') || ' HTG a bien été reçu.',
      '/shipments/' || p_request_id, jsonb_build_object('request_id', p_request_id)
    );
  END IF;

  PERFORM notify_once(
    uid, 'info',
    CASE WHEN p_plan = 'half' THEN 'Acompte expédition reçu — #' ELSE 'Paiement expédition reçu — #' END || v_code,
    to_char(v_charge, 'FM999,999,990') || ' HTG reçus' ||
      CASE WHEN p_plan = 'half' THEN ' (acompte, solde à la livraison : ' || to_char(v_quote - v_base, 'FM999,999,990') || ' HTG).' ELSE '.' END,
    '/admin/shipping-requests', jsonb_build_object('request_id', p_request_id)
  ) FROM get_admin_user_ids() AS uid;

  RETURN jsonb_build_object('success', true, 'charged', v_charge, 'late_fee', v_fee,
                            'plan', p_plan, 'balance_remaining', v_quote - v_base);
END;
$$;

-- Legacy one-argument signature now delegates to the new logic (no free bypass of late fees)
CREATE OR REPLACE FUNCTION pay_shipping_quote(p_request_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.pay_shipping_quote(p_request_id, 'full');
$$;

-- ── 6. Client pays the remaining half from the wallet ────────
CREATE OR REPLACE FUNCTION pay_shipping_balance(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         product_requests%ROWTYPE;
  v_wallet  uuid;
  v_balance numeric;
  v_rest    numeric;
  v_code    text := upper(left(p_request_id::text, 8));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.');
  END IF;

  SELECT * INTO r FROM product_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR r.user_id <> auth.uid() OR r.request_type <> 'shipping' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF r.status <> 'deposit_paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun solde à régler.');
  END IF;

  v_rest := GREATEST(COALESCE(r.quoted_amount_htg, 0) - COALESCE(r.paid_amount_htg, 0), 0);
  IF v_rest <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun solde à régler.');
  END IF;

  SELECT id, available_balance INTO v_wallet, v_balance
    FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.');
  END IF;
  IF v_balance < v_rest THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible, '
               || to_char(v_rest, 'FM999,999,990') || ' HTG requis).');
  END IF;

  UPDATE wallets SET available_balance = available_balance - v_rest, updated_at = now() WHERE id = v_wallet;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', v_rest, 'completed', 'Frais d''expédition — solde — demande #' || v_code);

  UPDATE product_requests SET
    paid_amount_htg = quoted_amount_htg,
    balance_paid_at = now(),
    invoiced_at     = now(),
    status          = 'invoiced',
    updated_at      = now()
  WHERE id = p_request_id;

  PERFORM notify_once(
    r.user_id, 'success', 'Solde réglé — expédition #' || v_code,
    'Merci ! Votre expédition est entièrement payée (' || to_char(v_rest, 'FM999,999,990') || ' HTG reçus).',
    '/shipments/' || p_request_id, jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'charged', v_rest);
END;
$$;

-- ── 7. Admin cashes the balance at delivery ──────────────────
CREATE OR REPLACE FUNCTION admin_collect_shipping_balance(p_request_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r      product_requests%ROWTYPE;
  v_rest numeric;
  v_code text := upper(left(p_request_id::text, 8));
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO r FROM product_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF r.status <> 'deposit_paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Aucun solde en attente pour cette demande.');
  END IF;

  v_rest := GREATEST(COALESCE(r.quoted_amount_htg, 0) - COALESCE(r.paid_amount_htg, 0), 0);

  UPDATE product_requests SET
    paid_amount_htg = quoted_amount_htg,
    balance_paid_at = now(),
    invoiced_at     = now(),
    status          = 'invoiced',
    admin_notes     = COALESCE(NULLIF(trim(COALESCE(p_note, '')), ''), 'Solde encaissé à la livraison.')
                      || COALESCE(E'\n' || admin_notes, ''),
    updated_at      = now()
  WHERE id = p_request_id;

  PERFORM notify_once(
    r.user_id, 'success', 'Solde reçu — expédition #' || v_code,
    'Nous avons bien reçu le solde de ' || to_char(v_rest, 'FM999,999,990') || ' HTG. Merci !',
    '/shipments/' || p_request_id, jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true, 'collected', v_rest);
END;
$$;

-- ── 8. Official quote sent: tell the client about deadline + options ─────────
CREATE OR REPLACE FUNCTION admin_send_shipping_quote(
  p_request_id        uuid,
  p_actual_cbm        numeric,
  p_actual_kg         numeric,
  p_quoted_amount_htg numeric,
  p_quoted_rate_id    uuid DEFAULT NULL,
  p_admin_notes       text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req     product_requests%ROWTYPE;
  v_due     timestamptz;
  t         record;
  v_deposit numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.');
  END IF;
  IF v_req.request_type <> 'shipping' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette demande n''est pas une demande d''expédition.');
  END IF;
  IF v_req.status NOT IN ('submitted', 'reviewing', 'received') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Statut incompatible avec l''envoi d''un devis.');
  END IF;

  UPDATE product_requests SET
    status            = 'quoted',
    actual_cbm        = p_actual_cbm,
    actual_kg         = p_actual_kg,
    quoted_amount_htg = p_quoted_amount_htg,
    quoted_rate_id    = p_quoted_rate_id,
    quoted_at         = now(),
    admin_notes       = COALESCE(p_admin_notes, admin_notes),
    updated_at        = now()
  WHERE id = p_request_id;

  SELECT payment_due_at INTO v_due FROM product_requests WHERE id = p_request_id;
  SELECT * INTO t FROM shipping_terms();
  v_deposit := ceil(p_quoted_amount_htg * t.deposit_pct / 100);

  PERFORM notify_once(
    v_req.user_id, 'success',
    'Devis d''expédition disponible — #' || upper(left(p_request_id::text, 8)),
    'Votre devis est prêt : ' || to_char(p_quoted_amount_htg, 'FM999,999,990') || ' HTG. '
      || CASE WHEN v_due IS NOT NULL
              THEN 'Réglez-le avant le ' || to_char(v_due AT TIME ZONE 'America/Port-au-Prince', 'DD/MM/YYYY')
                   || ' : au-delà, ' || to_char(t.late_fee_htg, 'FM999,999,990') || ' HTG de frais de retard s''ajoutent par jour. '
              ELSE '' END
      || 'Vous pouvez aussi payer ' || t.deposit_pct::integer || ' % maintenant ('
      || to_char(v_deposit, 'FM999,999,990') || ' HTG) et le reste à la livraison.',
    '/shipments/' || p_request_id, jsonb_build_object('request_id', p_request_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 9. Daily reminders + late fee accrual (run by pg_cron) ───────────────────
CREATE OR REPLACE FUNCTION shipping_payment_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r         record;
  t         record;
  v_left    integer;
  v_late    integer;
  v_fee     numeric;
  v_deposit numeric;
  v_code    text;
  v_name    text;
  v_sent    integer := 0;
BEGIN
  SELECT * INTO t FROM shipping_terms();

  FOR r IN
    SELECT * FROM product_requests
     WHERE request_type = 'shipping' AND status = 'quoted'
       AND payment_due_at IS NOT NULL AND COALESCE(quoted_amount_htg, 0) > 0
  LOOP
    v_code    := upper(left(r.id::text, 8));
    v_deposit := ceil(r.quoted_amount_htg * t.deposit_pct / 100);

    IF now() <= r.payment_due_at THEN
      v_left := ceil(extract(epoch FROM (r.payment_due_at - now())) / 86400)::integer;

      IF v_left IN (5, 2, 1) THEN
        PERFORM notify_once(
          r.user_id, 'warning',
          CASE WHEN v_left = 1 THEN 'Dernier jour pour régler votre expédition #' || v_code
               ELSE 'Rappel : ' || v_left || ' jours pour régler votre expédition #' || v_code END,
          'Votre devis de ' || to_char(r.quoted_amount_htg, 'FM999,999,990') || ' HTG est à régler avant le '
            || to_char(r.payment_due_at AT TIME ZONE 'America/Port-au-Prince', 'DD/MM/YYYY')
            || '. Passé ce délai, ' || to_char(t.late_fee_htg, 'FM999,999,990') || ' HTG de frais de retard s''ajoutent par jour. '
            || 'Option : payez ' || t.deposit_pct::integer || ' % maintenant (' || to_char(v_deposit, 'FM999,999,990') || ' HTG).',
          '/shipments/' || r.id, jsonb_build_object('request_id', r.id)
        );
        v_sent := v_sent + 1;
      END IF;
    ELSE
      v_late := shipping_late_days(r.payment_due_at);
      v_fee  := v_late * t.late_fee_htg;

      UPDATE product_requests SET late_fee_htg = v_fee, updated_at = now() WHERE id = r.id;

      PERFORM notify_once(
        r.user_id, 'error',
        'Frais de retard : ' || to_char(v_fee, 'FM999,999,990') || ' HTG — expédition #' || v_code,
        'Votre devis est en retard de ' || v_late || ' jour' || CASE WHEN v_late > 1 THEN 's' ELSE '' END
          || '. Total à régler : ' || to_char(r.quoted_amount_htg + v_fee, 'FM999,999,990') || ' HTG ('
          || to_char(t.late_fee_htg, 'FM999,999,990') || ' HTG de plus chaque jour). Réglez dès maintenant pour arrêter les frais.',
        '/shipments/' || r.id, jsonb_build_object('request_id', r.id)
      );
      v_sent := v_sent + 1;

      IF v_late = 1 THEN
        SELECT COALESCE(full_name, 'Client') INTO v_name FROM profiles WHERE user_id = r.user_id;
        PERFORM notify_once(
          uid, 'warning', 'Devis expédition impayé — #' || v_code,
          COALESCE(v_name, 'Client') || ' a dépassé l''échéance. Les frais de retard de '
            || to_char(t.late_fee_htg, 'FM999,999,990') || ' HTG/jour courent depuis aujourd''hui.',
          '/admin/shipping-requests', jsonb_build_object('request_id', r.id)
        ) FROM get_admin_user_ids() AS uid;
      END IF;
    END IF;
  END LOOP;

  RETURN v_sent;
END;
$$;

-- ── 10. Remaining half: remind when the cargo reaches Haiti / is being delivered
CREATE OR REPLACE FUNCTION notify_balance_due_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('arrived', 'distributing') AND NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM notify_once(
      pr.user_id, 'warning',
      CASE WHEN NEW.status = 'arrived'
           THEN 'Cargaison arrivée en Haïti — solde de '
           ELSE 'Livraison en cours — solde de ' END
        || to_char(GREATEST(pr.quoted_amount_htg - pr.paid_amount_htg, 0), 'FM999,999,990') || ' HTG',
      'Le solde de votre expédition est à régler à la livraison. Vous pouvez aussi le payer dès maintenant depuis votre portefeuille.',
      '/shipments/' || pr.id, jsonb_build_object('request_id', pr.id)
    )
    FROM product_requests pr
    WHERE pr.shipment_id = NEW.id AND pr.status = 'deposit_paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_balance_due_on_delivery ON shipments;
CREATE TRIGGER trg_notify_balance_due_on_delivery
  AFTER UPDATE OF status ON shipments
  FOR EACH ROW EXECUTE FUNCTION notify_balance_due_on_delivery();

-- ── 11. Permissions ──────────────────────────────────────────
-- Internal helpers must not be callable from the API (notify_once could spam any user)
REVOKE ALL ON FUNCTION notify_once(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_admin_user_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION shipping_payment_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION notify_balance_due_on_delivery() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION pay_shipping_quote(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pay_shipping_quote(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION pay_shipping_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_collect_shipping_balance(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION shipping_payment_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION pay_shipping_quote(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION pay_shipping_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION pay_shipping_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_collect_shipping_balance(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION shipping_payment_summary(uuid) TO authenticated;

-- ── 12. Daily schedule: 14:00 UTC = 09:00 in Haiti ───────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('shipping-payment-reminders', '0 14 * * *', $$SELECT public.shipping_payment_reminders()$$);
