-- Money & trust: wallet refunds, light KYC, ledger report

-- ── 1. Refunds ────────────────────────────────────────────────────────────────
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS refund_of uuid REFERENCES public.wallet_transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_refund_of_key
  ON public.wallet_transactions (refund_of) WHERE refund_of IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_refund_transaction(p_tx_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t        wallet_transactions%ROWTYPE;
  w        wallets%ROWTYPE;
  v_reason text := left(trim(coalesce(p_reason, '')), 200);
BEGIN
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Réservé aux administrateurs.');
  END IF;
  IF v_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le motif est obligatoire.');
  END IF;

  SELECT * INTO t FROM wallet_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction introuvable.');
  END IF;
  IF t.type <> 'payment' OR t.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Seul un paiement validé peut être remboursé.');
  END IF;
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE refund_of = p_tx_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce paiement a déjà été remboursé.');
  END IF;

  SELECT * INTO w FROM wallets WHERE id = t.wallet_id FOR UPDATE;

  UPDATE wallets SET available_balance = available_balance + t.amount, updated_at = now() WHERE id = w.id;

  INSERT INTO wallet_transactions (wallet_id, type, amount, status, payment_method, description, refund_of)
  VALUES (w.id, 'refund', t.amount, 'completed', 'wallet',
          'Remboursement : ' || v_reason || ' (réf. ' || left(t.id::text, 8) || ')', t.id);

  -- the order paid by this transaction is closed
  UPDATE product_orders SET payment_status = 'refunded', status = 'cancelled', updated_at = now()
   WHERE user_id = w.user_id AND payment_status = 'paid'
     AND t.description = 'Paiement commande produits #' || substr(id::text, 1, 8);
  UPDATE orders SET payment_status = 'refunded', status = 'cancelled', updated_at = now()
   WHERE user_id = w.user_id AND payment_status = 'paid'
     AND t.description = 'Paiement commande ' || tracking_code;

  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  VALUES (w.user_id, 'success', 'Remboursement reçu',
          to_char(t.amount, 'FM999G999G990') || ' HTG ont été remboursés sur votre portefeuille. Motif : ' || v_reason,
          'Refund received',
          to_char(t.amount, 'FM999G999G990') || ' HTG have been refunded to your wallet. Reason: ' || v_reason,
          '/wallet');

  RETURN jsonb_build_object('success', true, 'refunded', t.amount);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_refund_transaction(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_transaction(uuid, text) TO authenticated;

-- ── 2. Light KYC ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  doc_type      text NOT NULL CHECK (doc_type IN ('id_card', 'passport', 'driver_license')),
  doc_path      text NOT NULL,
  selfie_path   text NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  reject_reason text
);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY kyc_select ON public.kyc_submissions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR is_admin());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('kyc-documents', 'kyc-documents', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY kyc_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND (SELECT count(*) FROM storage.objects o
          WHERE o.bucket_id = 'kyc-documents' AND o.owner = (SELECT auth.uid())
            AND o.created_at > now() - interval '1 hour') < 6
  );
CREATE POLICY kyc_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents'
         AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR is_admin()));

CREATE OR REPLACE FUNCTION public.submit_kyc(p_doc_type text, p_doc_path text, p_selfie_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  IF p_doc_type NOT IN ('id_card', 'passport', 'driver_license') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de document invalide.');
  END IF;
  IF p_doc_path NOT LIKE v_uid::text || '/%' OR p_selfie_path NOT LIKE v_uid::text || '/%' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fichier invalide.');
  END IF;
  IF EXISTS (SELECT 1 FROM kyc_submissions WHERE user_id = v_uid AND status = 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Votre identité est déjà vérifiée.');
  END IF;

  INSERT INTO kyc_submissions (user_id, status, doc_type, doc_path, selfie_path, submitted_at)
  VALUES (v_uid, 'pending', p_doc_type, p_doc_path, p_selfie_path, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'pending', doc_type = EXCLUDED.doc_type, doc_path = EXCLUDED.doc_path,
    selfie_path = EXCLUDED.selfie_path, submitted_at = now(),
    reviewed_by = NULL, reviewed_at = NULL, reject_reason = NULL;

  PERFORM notify_once(
    uid, 'info', 'Vérification d''identité à examiner',
    'Un client a envoyé ses documents d''identité.', '/admin/kyc', jsonb_build_object('user_id', v_uid)
  ) FROM get_admin_user_ids() AS uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_kyc(p_user_id uuid, p_approve boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reason text := left(trim(coalesce(p_reason, '')), 200);
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('success', false, 'error', 'Réservé à l''équipe.'); END IF;
  IF NOT p_approve AND v_reason = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif du refus.');
  END IF;

  UPDATE kyc_submissions
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         reviewed_by = (SELECT auth.uid()), reviewed_at = now(),
         reject_reason = CASE WHEN p_approve THEN NULL ELSE v_reason END
   WHERE user_id = p_user_id AND status = 'pending';
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Aucune demande en attente.'); END IF;

  INSERT INTO notifications (user_id, type, title, body, title_en, body_en, link)
  VALUES (p_user_id,
          CASE WHEN p_approve THEN 'success' ELSE 'warning' END,
          CASE WHEN p_approve THEN 'Identité vérifiée' ELSE 'Vérification refusée' END,
          CASE WHEN p_approve THEN 'Votre identité a été vérifiée. Merci !' ELSE 'Votre vérification d''identité a été refusée : ' || v_reason END,
          CASE WHEN p_approve THEN 'Identity verified' ELSE 'Verification declined' END,
          CASE WHEN p_approve THEN 'Your identity has been verified. Thank you!' ELSE 'Your identity verification was declined: ' || v_reason END,
          '/profile');
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_kyc(text, text, text), public.admin_review_kyc(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_kyc(text, text, text), public.admin_review_kyc(uuid, boolean, text) TO authenticated;

-- Optional rule: payments above this amount need an approved identity (0 = off)
INSERT INTO app_settings (key, value, label, description, sensitive)
VALUES ('kyc_required_above_htg', '0', 'Vérification d''identité obligatoire au-dessus de (HTG)',
        '0 = désactivé. Un paiement de ce montant ou plus exige une identité vérifiée.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kyc_ok(p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_limit numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'kyc_required_above_htg'), 0);
BEGIN
  IF v_limit <= 0 OR p_amount < v_limit THEN RETURN true; END IF;
  RETURN EXISTS (SELECT 1 FROM kyc_submissions WHERE user_id = (SELECT auth.uid()) AND status = 'approved');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.kyc_ok(numeric) FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  f record;
  d text;
  n text;
  v text;
BEGIN
  FOR f IN SELECT unnest(ARRAY[
    'public.pay_order(uuid)', 'public.pay_product_order(uuid)',
    'public.pay_shipping_quote(uuid, text)', 'public.pay_shipping_balance(uuid)'
  ]) AS sig LOOP
    d := pg_get_functiondef(f.sig::regprocedure);
    v := (regexp_match(d, 'mfa_ok\((\w+)\)'))[1];
    IF v IS NULL THEN RAISE EXCEPTION 'mfa check not found in %', f.sig; END IF;
    n := replace(d, '  IF NOT public.mfa_ok(',
      '  IF NOT public.kyc_ok(' || v || E') THEN\n'
      || E'    RETURN jsonb_build_object(''success'', false, ''code'', ''kyc_required'',\n'
      || E'      ''error'', ''Vérification d''''identité requise pour ce paiement.'');\n'
      || E'  END IF;\n\n  IF NOT public.mfa_ok(');
    IF n = d THEN RAISE EXCEPTION 'anchor not found in %', f.sig; END IF;
    EXECUTE n;
  END LOOP;
END;
$$;

-- ── 3. Ledger report (admin) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_ledger_report()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Réservé à l''équipe.'; END IF;
  RETURN jsonb_build_object(
    'wallets', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', w.user_id, 'full_name', p.full_name,
               'balance', w.available_balance, 'computed', c.computed,
               'diff', w.available_balance - c.computed) ORDER BY abs(w.available_balance - c.computed) DESC)
        FROM wallets w
        LEFT JOIN profiles p ON p.user_id = w.user_id
        CROSS JOIN LATERAL (
          SELECT coalesce(sum(CASE t.type WHEN 'deposit' THEN t.amount WHEN 'refund' THEN t.amount
                                          WHEN 'payment' THEN -t.amount WHEN 'withdrawal' THEN -t.amount ELSE 0 END), 0) AS computed
            FROM wallet_transactions t WHERE t.wallet_id = w.id AND t.status = 'completed'
        ) c
    ), '[]'::jsonb),
    'stale_deposits', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', t.id, 'amount', t.amount, 'method', t.payment_method,
                                          'reference', t.reference, 'created_at', t.created_at) ORDER BY t.created_at)
        FROM wallet_transactions t
       WHERE t.type = 'deposit' AND t.status = 'pending' AND t.created_at < now() - interval '24 hours'
    ), '[]'::jsonb)
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_ledger_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ledger_report() TO authenticated;
