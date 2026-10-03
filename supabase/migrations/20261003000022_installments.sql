-- Pay a quote in 2 or 3 installments (wallet debits, schedule kept in the database)
INSERT INTO app_settings (key, value, label, description, sensitive) VALUES
  ('installments_enabled', 'true', 'Paiement en plusieurs fois', '"true" pour proposer 2 ou 3 versements sur les devis.', false),
  ('installments_min_total_htg', '20000', 'Montant minimum pour payer en plusieurs fois (HTG)', 'En dessous, le client paie en une fois.', false)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.order_installments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seq        integer NOT NULL CHECK (seq BETWEEN 1 AND 3),
  amount_htg numeric NOT NULL CHECK (amount_htg > 0),
  due_at     timestamptz NOT NULL,
  paid_at    timestamptz,
  UNIQUE (order_id, seq)
);
ALTER TABLE public.order_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_installments_select ON public.order_installments
  FOR SELECT TO authenticated
  USING (is_admin() OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = (SELECT auth.uid())));
-- no write policy: schedule and payments go through the functions below

CREATE OR REPLACE FUNCTION public.start_installments(p_order_id uuid, p_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  o         orders%ROWTYPE;
  v_total   numeric;
  v_min     numeric := coalesce((SELECT value::numeric FROM app_settings WHERE key = 'installments_min_total_htg'), 20000);
  v_enabled boolean := coalesce((SELECT value FROM app_settings WHERE key = 'installments_enabled'), 'true') = 'true';
  v_a       numeric[];
  v_wallet  uuid;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;
  IF NOT v_enabled THEN RETURN jsonb_build_object('success', false, 'error', 'Le paiement en plusieurs fois n''est pas disponible.'); END IF;
  IF p_count NOT IN (2, 3) THEN RETURN jsonb_build_object('success', false, 'error', 'Choisissez 2 ou 3 versements.'); END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;
  IF o.status NOT IN ('awaiting_payment', 'quote_accepted') OR o.payment_status <> 'unpaid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette commande n''est pas en attente de paiement.');
  END IF;
  IF EXISTS (SELECT 1 FROM order_installments WHERE order_id = p_order_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Un échéancier existe déjà pour cette commande.');
  END IF;

  SELECT q.total INTO v_total FROM quotes q WHERE q.id = o.quote_id;
  IF v_total IS NULL OR v_total <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Devis introuvable.'); END IF;
  IF v_total < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le montant est trop faible pour un paiement en plusieurs fois.');
  END IF;

  IF p_count = 2 THEN
    v_a := ARRAY[ceil(v_total * 0.5), v_total - ceil(v_total * 0.5)];
  ELSE
    v_a := ARRAY[ceil(v_total * 0.4), ceil(v_total * 0.3), v_total - ceil(v_total * 0.4) - ceil(v_total * 0.3)];
  END IF;

  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF v_balance < v_a[1] THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible, '
               || to_char(v_a[1], 'FM999,999,990') || ' HTG requis).');
  END IF;
  IF NOT public.kyc_ok(v_total) THEN
    RETURN jsonb_build_object('success', false, 'code', 'kyc_required', 'error', 'Vérification d''identité requise pour ce paiement.');
  END IF;
  IF NOT public.mfa_ok(v_a[1]) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required', 'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  INSERT INTO order_installments (order_id, seq, amount_htg, due_at, paid_at)
  SELECT p_order_id, s, v_a[s], now() + ((s - 1) * interval '14 days'), CASE WHEN s = 1 THEN now() END
    FROM generate_series(1, p_count) s;

  UPDATE wallets SET available_balance = available_balance - v_a[1], updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', v_a[1], 'completed', 'Paiement commande ' || o.tracking_code || ' (échéance 1/' || p_count || ')');

  UPDATE orders SET payment_status = 'partial', total_paid = v_a[1], status = 'paid', updated_at = now() WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'charged', v_a[1], 'remaining', p_count - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_next_installment(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  o         orders%ROWTYPE;
  i         order_installments%ROWTYPE;
  v_count   integer;
  v_left    integer;
  v_wallet  uuid;
  v_balance numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Non authentifié.'); END IF;

  SELECT * INTO o FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Commande introuvable.'); END IF;

  SELECT * INTO i FROM order_installments WHERE order_id = p_order_id AND paid_at IS NULL ORDER BY seq LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Aucune échéance à payer.'); END IF;

  SELECT id, available_balance INTO v_wallet, v_balance FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF v_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Portefeuille introuvable.'); END IF;
  IF v_balance < i.amount_htg THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Solde insuffisant (' || to_char(v_balance, 'FM999,999,990') || ' HTG disponible, '
               || to_char(i.amount_htg, 'FM999,999,990') || ' HTG requis).');
  END IF;
  IF NOT public.mfa_ok(i.amount_htg) THEN
    RETURN jsonb_build_object('success', false, 'code', 'mfa_required', 'error', 'Confirmation par code requise pour ce paiement.');
  END IF;

  SELECT count(*) INTO v_count FROM order_installments WHERE order_id = p_order_id;

  UPDATE wallets SET available_balance = available_balance - i.amount_htg, updated_at = now() WHERE id = v_wallet;
  INSERT INTO wallet_transactions (wallet_id, type, amount, status, description)
  VALUES (v_wallet, 'payment', i.amount_htg, 'completed', 'Paiement commande ' || o.tracking_code || ' (échéance ' || i.seq || '/' || v_count || ')');

  UPDATE order_installments SET paid_at = now() WHERE id = i.id;
  SELECT count(*) INTO v_left FROM order_installments WHERE order_id = p_order_id AND paid_at IS NULL;

  UPDATE orders SET total_paid = coalesce(total_paid, 0) + i.amount_htg,
                    payment_status = CASE WHEN v_left = 0 THEN 'paid' ELSE 'partial' END,
                    updated_at = now()
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'charged', i.amount_htg, 'remaining', v_left);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_installments(uuid, integer), public.pay_next_installment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_installments(uuid, integer), public.pay_next_installment(uuid) TO authenticated;

-- Nothing leaves for Haiti while installments are still due
CREATE OR REPLACE FUNCTION public.guard_partial_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.payment_status = 'partial'
     AND NEW.status IN ('shipped', 'in_transit', 'arrived_haiti', 'customs_processing', 'out_for_delivery', 'delivered', 'closed') THEN
    RAISE EXCEPTION 'Solde à régler avant l''expédition (paiement échelonné en cours).';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_partial_orders() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_guard_partial_orders
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_partial_orders();
