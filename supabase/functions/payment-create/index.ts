import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }
const fail = (error: string, status: number, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error, ...extra }), { status, headers: { ...JSON_HEADERS, ...headers } })

const UUID = /^[0-9a-f-]{36}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Auth: verify user JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return fail('Unauthorized', 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify user
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return fail('Unauthorized', 401)

    // Rate limit per user (see check_rate_limit in the database)
    const { data: allowed } = await supabaseAdmin.rpc('check_rate_limit', { p_key: `payment-create:${user.id}`, p_max: 10, p_window_seconds: 600 })
    if (allowed === false) return fail('Trop de requêtes, réessayez dans quelques minutes.', 429, {}, { 'Retry-After': '600' })

    const body = await req.json().catch(() => ({})) as {
      amount?: unknown; method?: unknown; kind?: unknown; items?: unknown; shipping_rate_id?: unknown; notes?: unknown; source?: unknown
    }
    const method = body.method
    const checkout = body.kind === 'checkout'
    if (!method || typeof method !== 'string' || !['moncash', 'natcash'].includes(method)) return fail('Méthode invalide', 400)

    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    // Account restrictions set by the team (suspended / banned / restricted actions) are enforced by the database
    const { data: allowed2 } = await userClient.rpc('user_can', { p_action: checkout ? 'orders' : 'deposits' })
    if (allowed2 === false) return fail('Cette action est restreinte sur votre compte. Contactez le support.', 403)

    // The amount: for a top-up the customer's choice; for a checkout, what the database says the cart costs (never the browser)
    let amount = body.amount
    let cleanItems: Array<{ product_id: string; variant_id: string | null; quantity: number }> = []
    const rateId = typeof body.shipping_rate_id === 'string' && UUID.test(body.shipping_rate_id) ? body.shipping_rate_id : null
    if (checkout) {
      const raw = Array.isArray(body.items) ? body.items : []
      cleanItems = raw.slice(0, 100).map((i) => {
        const o = (i ?? {}) as Record<string, unknown>
        return {
          product_id: String(o.product_id ?? ''), quantity: Number(o.quantity),
          variant_id: typeof o.variant_id === 'string' && o.variant_id ? o.variant_id : null,
        }
      })
      if (cleanItems.length === 0 || cleanItems.some((i) => !UUID.test(i.product_id) || !Number.isInteger(i.quantity) || i.quantity < 1 || (i.variant_id !== null && !UUID.test(i.variant_id)))) {
        return fail('Panier invalide', 400)
      }
      const { data: quote } = await userClient.rpc('quote_checkout', { p_items: cleanItems, p_rate: rateId })
      if (!quote?.success) return fail(quote?.error || 'Commande impossible', quote?.code === 'kyc_required' ? 403 : 400, { code: quote?.code })
      amount = Math.ceil(Number(quote.total))
    }

    // Validate input
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 20 || amount > 1_000_000) return fail('Montant minimum 20 HTG', 400)

    // Top-ups and payments need the same fresh MFA code as wallet payments.
    // The check runs with the caller's own JWT so it reads their session (amr claim).
    const { data: mfaOk } = await userClient.rpc('check_mfa', { p_amount: amount })
    if (mfaOk === false) return fail('Confirmation par code requise pour ce paiement.', 403, { code: 'mfa_required' })

    // Read payment settings (service role bypasses RLS)
    const { data: settings } = await supabaseAdmin.from('app_settings').select('key, value').in('key', ['payment_client_id', 'payment_base_url'])
    const cfg = Object.fromEntries((settings ?? []).map((s: { key: string; value: string }) => [s.key, s.value]))

    if (!cfg.payment_client_id) return fail('API paiement non configurée', 503)

    // The wallet is always the caller's own (never trust a wallet id sent by the browser)
    const { data: wallet } = await supabaseAdmin.from('wallets').select('id').eq('user_id', user.id).maybeSingle()
    if (!wallet) return fail('Portefeuille introuvable', 404)
    const wallet_id = wallet.id

    // Generate unique reference
    const timestamp = Date.now()
    const reference_id = `KW-${user.id.slice(0, 8)}-${timestamp}`

    // Call PLOP PLOP API
    const baseUrl = cfg.payment_base_url || 'https://plopplop.solutionip.app'
    const plopRes = await fetch(`${baseUrl}/api/paiement-marchand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: cfg.payment_client_id,
        refference_id: reference_id,
        montant: amount,
        payment_method: method,
      }),
    })

    const plopData = await plopRes.json()

    if (!plopData.status || !plopData.url) return fail(plopData.message || 'Erreur PLOP PLOP', 502)

    if (checkout) {
      // Nothing is ordered yet: only the intent is remembered, the orders are placed once the gateway confirms the payment
      const { error: intentError } = await supabaseAdmin.from('checkout_intents').insert({
        user_id: user.id, reference: reference_id, method, amount, items: cleanItems, shipping_rate_id: rateId,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
        source: body.source === 'buy_now' ? 'buy_now' : 'cart', plop_transaction_id: plopData.transaction_id ?? null,
      })
      if (intentError) return fail('Enregistrement du paiement impossible', 500)
    } else {
      // Store pending transaction: it stays out of the admin queue and is credited only when the gateway confirms it
      await supabaseAdmin.from('wallet_transactions').insert({
        wallet_id,
        type: 'deposit',
        amount,
        status: 'pending',
        payment_method: method,
        reference: reference_id,
        plop_transaction_id: plopData.transaction_id,
        description: `Recharge ${method === 'moncash' ? 'MonCash' : 'NatCash'} - ${amount.toLocaleString('fr-HT')} HTG`,
      })
    }

    return new Response(
      JSON.stringify({ url: plopData.url, reference_id, transaction_id: plopData.transaction_id }),
      { headers: JSON_HEADERS }
    )
  } catch (err) {
    return fail('Erreur interne', 500, { detail: String(err) })
  }
})
