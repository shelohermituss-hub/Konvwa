import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Card payments through Stripe Checkout (hosted page), test or live depending on the key stored in app_settings.
//   POST {kind:'topup'|'checkout', ...}   (user JWT)  → creates the Checkout Session, returns its url
//   POST {action:'verify', reference}     (user JWT)  → asks Stripe for the session status and settles it
//   POST ?hook=1                          (Stripe)    → signed webhook, settles on checkout.session.completed
// Nothing is credited or ordered on the word of the browser or of a webhook body: the session is always re-read from Stripe.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json' }
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } })

const UUID = /^[0-9a-f-]{36}$/i
const ORIGINS = ['https://konvwa.shop', 'https://www.konvwa.shop', 'https://konvwa.app', 'http://localhost:5173']
const STRIPE = 'https://api.stripe.com/v1'

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function setting(db: ReturnType<typeof admin>, key: string): Promise<string | null> {
  const { data } = await db.from('app_settings').select('value').eq('key', key).maybeSingle()
  return (data?.value as string | undefined) || null
}

async function stripe(secret: string, path: string, params?: URLSearchParams) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${secret}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: params,
  })
  return await res.json().catch(() => ({})) as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Stripe-Signature: t=timestamp,v1=hmac(secret, `${t}.${body}`) — rejects anything older than 5 minutes. */
async function validSignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]))
  const t = Number(parts.t)
  if (!t || Math.abs(Date.now() / 1000 - t) > 300 || !parts.v1) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)))
  if (expected.length !== parts.v1.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i)
  return diff === 0
}

/**
 * Settle a payment from what Stripe says about the session. Idempotent: a top-up is claimed atomically, a checkout is
 * fulfilled by a locked database function. Returns what the return page needs.
 */
async function settle(db: ReturnType<typeof admin>, secret: string, reference: string): Promise<Record<string, unknown>> {
  const { data: intent } = await db.from('checkout_intents').select('id, status, result, amount, plop_transaction_id').eq('reference', reference).maybeSingle()
  const { data: tx } = intent ? { data: null } : await db.from('wallet_transactions').select('id, wallet_id, amount, status, plop_transaction_id, payment_method').eq('reference', reference).maybeSingle()
  const row = intent ?? tx
  if (!row || (tx && tx.payment_method !== 'stripe')) return { error: 'Paiement introuvable', code: 404 }
  if (intent && (intent.status === 'completed' || intent.status === 'order_failed')) {
    return { kind: 'checkout', verified: true, already_processed: true, ...(intent.result as object ?? {}), ok: intent.status === 'completed' }
  }
  if (tx && tx.status === 'completed') return { kind: 'topup', verified: true, already_processed: true, amount: tx.amount }

  const sessionId = row.plop_transaction_id as string | null
  if (!sessionId) return { error: 'Session de paiement introuvable', code: 404 }
  const s = await stripe(secret, `/checkout/sessions/${encodeURIComponent(sessionId)}`)
  // The session must be the one created for this reference, for exactly the amount asked (the metadata was set when it was created).
  if (s.client_reference_id !== reference || String(s.metadata?.htg) !== String(row.amount)) return { error: 'Paiement incohérent', code: 409 }
  if (String(s.metadata?.usd_cents) !== String(s.amount_total)) return { error: 'Montant incohérent', code: 409 }

  const kind = intent ? 'checkout' : 'topup'
  if (s.payment_status === 'paid') {
    if (intent) {
      const { data: done, error } = await db.rpc('fulfill_checkout_intent', { p_reference: reference })
      if (error || !done) return { error: 'Commande impossible, réessayez', code: 500 }
      return { kind, verified: true, amount: intent.amount, ...done, ok: done.success === true }
    }
    const { data: claimed } = await db.from('wallet_transactions').update({ status: 'completed' }).eq('id', tx!.id).in('status', ['pending', 'failed']).select('id')
    if (!claimed?.length) return { kind, verified: true, already_processed: true, amount: tx!.amount }
    const { error } = await db.rpc('increment_wallet_balance', { p_wallet_id: tx!.wallet_id, p_amount: tx!.amount })
    if (error) {
      await db.from('wallet_transactions').update({ status: 'pending' }).eq('id', tx!.id)
      return { error: 'Crédit impossible, réessayez', code: 500 }
    }
    return { kind, verified: true, amount: tx!.amount, method: 'stripe' }
  }
  if (s.status === 'expired') {
    if (intent) await db.from('checkout_intents').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', intent.id).eq('status', 'pending')
    else await db.from('wallet_transactions').update({ status: 'failed' }).eq('id', tx!.id).eq('status', 'pending')
    return { kind, verified: false, failed: true }
  }
  return { kind, verified: false, status: 'pending', failed: false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const db = admin()
    const secret = await setting(db, 'stripe_secret_key')
    if (!secret) return json({ error: 'Paiement par carte non configuré' }, 503)

    // ── Stripe webhook ──
    if (new URL(req.url).searchParams.get('hook')) {
      const body = await req.text()
      const whsec = await setting(db, 'stripe_webhook_secret')
      if (!whsec || !(await validSignature(body, req.headers.get('stripe-signature'), whsec))) return json({ error: 'Signature invalide' }, 400)
      const event = JSON.parse(body) as { type?: string; data?: { object?: { client_reference_id?: string } } }
      const ref = event.data?.object?.client_reference_id
      if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'checkout.session.expired') && typeof ref === 'string') {
        await settle(db, secret, ref)
      }
      return json({ received: true })
    }

    // ── From the app: the user's JWT ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const { data: { user }, error: authError } = await db.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: allowed } = await db.rpc('check_rate_limit', { p_key: `stripe-checkout:${user.id}`, p_max: 30, p_window_seconds: 600 })
    if (allowed === false) return json({ error: 'Trop de requêtes, réessayez dans quelques minutes.' }, 429, { 'Retry-After': '600' })

    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    if (body.action === 'verify') {
      const reference = body.reference
      if (typeof reference !== 'string' || reference.length > 80) return json({ error: 'reference manquante' }, 400)
      // only the owner of the payment (or the team) may check it
      const { data: i } = await db.from('checkout_intents').select('user_id').eq('reference', reference).maybeSingle()
      let owner = i?.user_id as string | undefined
      if (!owner) {
        const { data: t } = await db.from('wallet_transactions').select('wallets!inner(user_id)').eq('reference', reference).maybeSingle()
        owner = (t as unknown as { wallets?: { user_id: string } } | null)?.wallets?.user_id
      }
      if (!owner) return json({ error: 'Paiement introuvable' }, 404)
      if (owner !== user.id) {
        const { data: me } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
        if (!me || !['admin', 'manager'].includes(me.role)) return json({ error: 'Forbidden' }, 403)
      }
      const r = await settle(db, secret, reference)
      return typeof r.code === 'number' ? json({ error: r.error }, r.code) : json(r)
    }

    const checkout = body.kind === 'checkout'
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: can } = await userClient.rpc('user_can', { p_action: checkout ? 'orders' : 'deposits' })
    if (can === false) return json({ error: 'Cette action est restreinte sur votre compte. Contactez le support.' }, 403)

    // The amount (HTG): a top-up is the customer's choice, a checkout is what the database says the cart costs.
    let amount = body.amount
    let cleanItems: Array<{ product_id: string; variant_id: string | null; quantity: number }> = []
    const rateId = typeof body.shipping_rate_id === 'string' && UUID.test(body.shipping_rate_id) ? body.shipping_rate_id : null
    if (checkout) {
      const raw = Array.isArray(body.items) ? body.items : []
      cleanItems = raw.slice(0, 100).map((i) => {
        const o = (i ?? {}) as Record<string, unknown>
        return { product_id: String(o.product_id ?? ''), quantity: Number(o.quantity), variant_id: typeof o.variant_id === 'string' && o.variant_id ? o.variant_id : null }
      })
      if (cleanItems.length === 0 || cleanItems.some((i) => !UUID.test(i.product_id) || !Number.isInteger(i.quantity) || i.quantity < 1 || (i.variant_id !== null && !UUID.test(i.variant_id)))) return json({ error: 'Panier invalide' }, 400)
      const { data: quote } = await userClient.rpc('quote_checkout', { p_items: cleanItems, p_rate: rateId })
      if (!quote?.success) return json({ error: quote?.error || 'Commande impossible', code: quote?.code }, quote?.code === 'kyc_required' ? 403 : 400)
      amount = Math.ceil(Number(quote.total))
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 100 || amount > 1_000_000) return json({ error: 'Montant minimum 100 HTG' }, 400)

    const { data: mfaOk } = await userClient.rpc('check_mfa', { p_amount: amount })
    if (mfaOk === false) return json({ error: 'Confirmation par code requise pour ce paiement.', code: 'mfa_required' }, 403)

    const { data: wallet } = await db.from('wallets').select('id').eq('user_id', user.id).maybeSingle()
    if (!wallet) return json({ error: 'Portefeuille introuvable' }, 404)

    // Stripe charges in USD: HTG converted with the rate the team maintains (Stripe's minimum is 0.50 USD)
    const rate = Number(await setting(db, 'usd_to_htg_rate'))
    if (!Number.isFinite(rate) || rate <= 0) return json({ error: 'Taux de change indisponible' }, 503)
    const cents = Math.round((amount / rate) * 100)
    if (cents < 50) return json({ error: 'Montant trop faible pour un paiement par carte' }, 400)

    const reference = `KWS-${user.id.slice(0, 8)}-${Date.now()}`
    const origin = ORIGINS.includes(req.headers.get('origin') ?? '') ? req.headers.get('origin')! : ORIGINS[0]
    const p = new URLSearchParams({
      mode: 'payment',
      client_reference_id: reference,
      success_url: `${origin}/payment/return?ref=${reference}`,
      cancel_url: `${origin}/payment/return?ref=${reference}`,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(cents),
      'line_items[0][price_data][product_data][name]': checkout ? 'Commande KONVWA' : 'Recharge portefeuille KONVWA',
      'line_items[0][price_data][product_data][description]': `${amount.toLocaleString('fr-HT')} HTG`,
      'metadata[htg]': String(amount),
      'metadata[usd_cents]': String(cents),
      'metadata[user_id]': user.id,
      expires_at: String(Math.floor(Date.now() / 1000) + 3600),
    })
    if (user.email) p.set('customer_email', user.email)
    const session = await stripe(secret, '/checkout/sessions', p)
    if (!session.url || !session.id) return json({ error: session.error?.message || 'Erreur Stripe' }, 502)

    if (checkout) {
      const { error } = await db.from('checkout_intents').insert({
        user_id: user.id, reference, method: 'stripe', amount, items: cleanItems, shipping_rate_id: rateId,
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : null,
        source: body.source === 'buy_now' ? 'buy_now' : 'cart', plop_transaction_id: session.id,
      })
      if (error) return json({ error: 'Enregistrement du paiement impossible' }, 500)
    } else {
      const { error } = await db.from('wallet_transactions').insert({
        wallet_id: wallet.id, type: 'deposit', amount, status: 'pending', payment_method: 'stripe', reference,
        plop_transaction_id: session.id, description: `Recharge carte (Stripe) - ${amount.toLocaleString('fr-HT')} HTG`,
      })
      if (error) return json({ error: 'Enregistrement du paiement impossible' }, 500)
    }
    return json({ url: session.url, reference_id: reference })
  } catch (err) {
    return json({ error: 'Erreur interne', detail: String(err) }, 500)
  }
})
