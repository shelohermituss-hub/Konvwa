import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })

const FAILED_STATUSES = new Set(['cancel', 'cancelled', 'canceled', 'annule', 'annulé', 'failed', 'fail', 'error', 'expired', 'refused', 'rejected', 'declined'])

/**
 * What the gateway says about a payment: only an explicit "ok" validates it. Cancelled / failed / refused is final; anything else
 * (pending, unknown) means we keep waiting: nothing is credited, ordered or shown to the team.
 */
function interpret(plop: { status?: unknown; trans_status?: unknown }): 'ok' | 'failed' | 'pending' {
  const st = String(plop.trans_status ?? '').trim().toLowerCase()
  if (st === 'ok') return 'ok'
  if (plop.status === false || FAILED_STATUSES.has(st)) return 'failed'
  return 'pending'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    // Rate limit per user (see check_rate_limit in the database)
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', { p_key: `payment-verify:${user.id}`, p_max: 60, p_window_seconds: 600 })
    if (allowed === false) {
      return new Response(JSON.stringify({ error: 'Trop de requêtes, réessayez dans quelques minutes.' }), { status: 429, headers: { ...JSON_HEADERS, 'Retry-After': '600' } })
    }

    const { reference_id } = await req.json().catch(() => ({})) as { reference_id?: unknown }
    if (typeof reference_id !== 'string' || !reference_id || reference_id.length > 80) return json({ error: 'reference_id manquant' }, 400)

    // Read settings
    const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value').in('key', ['payment_client_id', 'payment_base_url'])
    const cfg = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))
    if (!cfg.payment_client_id) return json({ error: 'API non configurée' }, 503)

    const isStaff = async () => {
      const { data: me } = await supabaseAdmin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
      return !!me && ['admin', 'manager'].includes(me.role)
    }
    const askGateway = async () => {
      const baseUrl = cfg.payment_base_url || 'https://plopplop.solutionip.app'
      const res = await fetch(`${baseUrl}/api/paiement-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: cfg.payment_client_id, refference_id: reference_id }),
      })
      return await res.json().catch(() => ({})) as { status?: unknown; trans_status?: unknown; method?: unknown }
    }

    // ── A payment made at the checkout: the orders are placed only when the gateway confirms it ──
    const { data: intent } = await supabaseAdmin.from('checkout_intents').select('id, user_id, status, result, amount').eq('reference', reference_id).maybeSingle()
    if (intent) {
      if (intent.user_id !== user.id && !(await isStaff())) return json({ error: 'Forbidden' }, 403)
      if (intent.status === 'completed' || intent.status === 'order_failed') {
        return json({ kind: 'checkout', verified: true, already_processed: true, ...(intent.result as object ?? {}), ok: intent.status === 'completed' })
      }
      const state = interpret(await askGateway())
      if (state === 'ok') {
        const { data: done, error: fulfillError } = await supabaseAdmin.rpc('fulfill_checkout_intent', { p_reference: reference_id })
        if (fulfillError || !done) return json({ error: 'Commande impossible, réessayez' }, 500)
        return json({ kind: 'checkout', verified: true, amount: intent.amount, ...done, ok: done.success === true })
      }
      if (state === 'failed') {
        await supabaseAdmin.from('checkout_intents').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', intent.id).eq('status', 'pending')
        return json({ kind: 'checkout', verified: false, failed: true })
      }
      // cancelled after 1 h without validation: the customer must start a new request (a late genuine payment is still honoured above)
      if (intent.status === 'failed') return json({ kind: 'checkout', verified: false, failed: true, expired: true })
      return json({ kind: 'checkout', verified: false, status: 'pending' })
    }

    // ── A wallet top-up ──
    const plopData = await askGateway()

    const { data: tx } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, wallet_id, amount, status, wallets!inner(user_id)')
      .eq('reference', reference_id)
      .maybeSingle()
    if (!tx) return json({ error: 'Transaction introuvable' }, 404)

    // Only the owner of the deposit (or an admin) may trigger its verification
    const owner = (tx as unknown as { wallets: { user_id: string } }).wallets?.user_id
    if (owner !== user.id && !(await isStaff())) return json({ error: 'Forbidden' }, 403)

    // Already processed — idempotent
    if (tx.status === 'completed') return json({ kind: 'topup', verified: true, already_processed: true, amount: tx.amount })

    const state = interpret(plopData)
    if (state === 'ok') {
      // Claim the transaction atomically: of two concurrent verifications only one gets the row,
      // so the wallet can never be credited twice for the same payment.
      const { data: claimed } = await supabaseAdmin
        .from('wallet_transactions')
        .update({ status: 'completed' })
        .eq('id', tx.id)
        .in('status', ['pending', 'failed', 'cancelled'])  // 'cancelled' = expired after 1 h: a late genuine payment is still credited
        .select('id')
      if (!claimed?.length) return json({ kind: 'topup', verified: true, already_processed: true, amount: tx.amount })

      const { error: creditError } = await supabaseAdmin.rpc('increment_wallet_balance', { p_wallet_id: tx.wallet_id, p_amount: tx.amount })
      if (creditError) {
        await supabaseAdmin.from('wallet_transactions').update({ status: 'pending' }).eq('id', tx.id)
        return json({ error: 'Crédit impossible, réessayez' }, 500)
      }
      return json({ kind: 'topup', verified: true, amount: tx.amount, method: plopData.method })
    }
    if (state === 'failed') {
      await supabaseAdmin.from('wallet_transactions').update({ status: 'failed' }).eq('id', tx.id).eq('status', 'pending')
      return json({ kind: 'topup', verified: false, status: String(plopData.trans_status ?? 'no'), failed: true })
    }
    // cancelled after 1 h without validation: the customer must start a new request
    if (tx.status === 'cancelled') return json({ kind: 'topup', verified: false, failed: true, expired: true })
    // still waiting for the customer / the gateway: nothing changes, nothing is shown to the team
    return json({ kind: 'topup', verified: false, status: String(plopData.trans_status ?? 'pending'), failed: false })
  } catch (err) {
    return json({ error: 'Erreur interne', detail: String(err) }, 500)
  }
})
