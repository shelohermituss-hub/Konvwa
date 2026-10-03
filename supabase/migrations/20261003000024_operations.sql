-- Operations: package scans (QR labels) and automatic reminders

CREATE TABLE IF NOT EXISTS public.package_scans (
  request_id uuid NOT NULL REFERENCES public.product_requests(id) ON DELETE CASCADE,
  package_no integer NOT NULL CHECK (package_no BETWEEN 1 AND 500),
  scanned_by uuid,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, package_no)
);
ALTER TABLE public.package_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY package_scans_admin_select ON public.package_scans FOR SELECT TO authenticated USING (is_admin());

-- Label code: KW1:<request uuid>:<package n>/<total packages>
CREATE OR REPLACE FUNCTION public.admin_scan_package(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m        text[] := regexp_match(coalesce(p_code, ''), '^KW1:([0-9a-fA-F-]{36}):(\d{1,3})/(\d{1,3})$');
  v_req    product_requests%ROWTYPE;
  v_no     integer;
  v_total  integer;
  v_scans  integer;
  v_name   text;
  v_new    boolean;
  v_recv   boolean := false;
  r        jsonb;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF m IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Étiquette non reconnue.'); END IF;
  v_no := m[2]::integer;
  v_total := m[3]::integer;
  IF v_no < 1 OR v_no > v_total THEN RETURN jsonb_build_object('success', false, 'error', 'Étiquette non reconnue.'); END IF;

  SELECT * INTO v_req FROM product_requests WHERE id = m[1]::uuid AND request_type = 'shipping';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Demande introuvable.'); END IF;

  INSERT INTO package_scans (request_id, package_no, scanned_by) VALUES (v_req.id, v_no, (SELECT auth.uid()))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_scans = ROW_COUNT;
  v_new := v_scans > 0;

  SELECT count(*) INTO v_scans FROM package_scans WHERE request_id = v_req.id;
  v_total := greatest(v_total, coalesce(v_req.package_count, 0));
  SELECT coalesce(full_name, '') INTO v_name FROM profiles WHERE user_id = v_req.user_id;

  IF v_scans >= v_total AND v_req.status IN ('submitted', 'reviewing', 'quoted') THEN
    r := public.admin_mark_shipping_received(v_req.id, 'Reçu par scan des étiquettes');
    v_recv := coalesce((r ->> 'success')::boolean, false);
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', v_req.id, 'package_no', v_no, 'total', v_total,
                            'scanned', v_scans, 'already_scanned', NOT v_new, 'received', v_recv, 'customer', v_name);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_scan_package(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_scan_package(text) TO authenticated;

-- Reminders, run once a day by pg_cron (not callable from the API)
CREATE OR REPLACE FUNCTION public.remind(p_user uuid, p_title text, p_body text, p_title_en text, p_body_en text, p_link text, p_days integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = p_user AND n.title = p_title AND n.link IS NOT DISTINCT FROM p_link
               AND n.created_at > now() - make_interval(days => p_days)) THEN
    RETURN false;
  END IF;
  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  VALUES (p_user, 'warning', p_title, p_body, p_title_en, p_body_en, p_link);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r       record;
  v_count integer := 0;
BEGIN
  -- a quote that was sent but not accepted
  FOR r IN SELECT o.id, o.user_id, o.tracking_code FROM orders o
            WHERE o.status = 'quote_sent' AND o.updated_at < now() - interval '2 days' LOOP
    IF remind(r.user_id, 'Rappel : votre devis vous attend',
              'Le devis de la commande ' || r.tracking_code || ' est prêt. Consultez-le pour lancer votre commande.',
              'Reminder: your quote is waiting',
              'The quote for order ' || r.tracking_code || ' is ready. Review it to start your order.',
              '/orders/' || r.id, 3) THEN v_count := v_count + 1; END IF;
  END LOOP;

  -- an accepted quote that is not paid
  FOR r IN SELECT o.id, o.user_id, o.tracking_code FROM orders o
            WHERE o.status = 'awaiting_payment' AND o.payment_status = 'unpaid' AND o.updated_at < now() - interval '2 days' LOOP
    IF remind(r.user_id, 'Rappel : commande en attente de paiement',
              'La commande ' || r.tracking_code || ' attend votre paiement (en une fois ou en plusieurs fois).',
              'Reminder: order awaiting payment',
              'Order ' || r.tracking_code || ' is waiting for your payment (in one go or in installments).',
              '/orders/' || r.id, 3) THEN v_count := v_count + 1; END IF;
  END LOOP;

  -- installments due soon or late
  FOR r IN SELECT i.order_id, i.seq, i.amount_htg, i.due_at, o.user_id, o.tracking_code
             FROM order_installments i JOIN orders o ON o.id = i.order_id
            WHERE i.paid_at IS NULL AND i.due_at < now() + interval '2 days' LOOP
    IF r.due_at < now() THEN
      IF remind(r.user_id, 'Versement en retard',
                'Le versement ' || r.seq || ' de la commande ' || r.tracking_code || ' (' || to_char(r.amount_htg, 'FM999G999G990') || ' HTG) est en retard. L''expédition attend le solde.',
                'Installment overdue',
                'Installment ' || r.seq || ' of order ' || r.tracking_code || ' (' || to_char(r.amount_htg, 'FM999G999G990') || ' HTG) is overdue. Shipping is waiting for the balance.',
                '/orders/' || r.order_id, 2) THEN v_count := v_count + 1; END IF;
    ELSE
      IF remind(r.user_id, 'Versement bientôt dû',
                'Le versement ' || r.seq || ' de la commande ' || r.tracking_code || ' (' || to_char(r.amount_htg, 'FM999G999G990') || ' HTG) arrive à échéance.',
                'Installment due soon',
                'Installment ' || r.seq || ' of order ' || r.tracking_code || ' (' || to_char(r.amount_htg, 'FM999G999G990') || ' HTG) is due soon.',
                '/orders/' || r.order_id, 2) THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;

  -- a shipping quote still to pay as the deadline approaches
  FOR r IN SELECT pr.id, pr.user_id FROM product_requests pr
            WHERE pr.request_type = 'shipping' AND pr.status = 'quoted' AND pr.payment_due_at IS NOT NULL
              AND pr.payment_due_at < now() + interval '3 days' LOOP
    IF remind(r.user_id, 'Rappel : devis d''expédition à régler',
              'Votre devis d''expédition #' || upper(left(r.id::text, 8)) || ' arrive à échéance. Réglez-le pour éviter des frais de retard.',
              'Reminder: shipping quote to pay',
              'Your shipping quote #' || upper(left(r.id::text, 8)) || ' is almost due. Pay it to avoid late fees.',
              '/shipments/' || r.id, 2) THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remind(uuid, text, text, text, text, text, integer), public.send_reminders() FROM PUBLIC, anon, authenticated;

-- every day at 14:00 UTC (9:00 in Haiti)
SELECT cron.schedule('konvwa-daily-reminders', '0 14 * * *', 'SELECT public.send_reminders()');
