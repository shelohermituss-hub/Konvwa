// Nightly price follow-up of products imported from Muscle & Strength: re-reads the supplier page (Firecrawl) and hands the price
// and the quantity offers of the day to the database function `apply_price_sync`, which does all the arithmetic.
// Called by the pg_cron job `konvwa-price-sync` (header x-cron-secret) or by an admin for one product ({ product_id }).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { impliedUsd, needsReview, promoTiers } from './promos.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Only product pages of the supplier are ever read (anti-SSRF: the address comes from the database but is checked again). */
const SUPPLIER_PAGE = /^https:\/\/(?:www\.)?muscleandstrength\.com\/[^\s]+$/i
const BATCH = 4
const TIME_BUDGET_MS = 110_000

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    price: { type: 'number', description: 'REGULAR price of the product in USD for the default option: the normal price, never a sale price, coupon price or the price of a multi-buy offer; number only' },
    currency: { type: 'string', description: 'ISO currency code, e.g. USD' },
    promotions: {
      type: 'array', maxItems: 8,
      description: 'Quantity offers announced on this product page (banners, labels, near the price): "2 for $40", "Buy 1 Get 1 Free", "Buy 2 Get 1 Free", "3 for $90"… One entry per offer. Leave out percent-off sales, free shipping, free gifts and coupon codes.',
      items: { type: 'object', properties: {
        kind: { type: 'string', enum: ['multi_buy', 'free_item', 'other'], description: 'multi_buy: N items for a fixed total price; free_item: buy N, get M free' },
        qty: { type: 'integer', description: 'multi_buy: number of items in the offer ("2" in "2 for $40"); free_item: number of items to buy ("1" in "buy 1 get 1 free")' },
        total_price: { type: 'number', description: 'multi_buy only: total price of the qty items in USD ("40" in "2 for $40")' },
        free_qty: { type: 'integer', description: 'free_item only: number of free items ("1" in "buy 1 get 1 free")' },
        text: { type: 'string', description: 'The offer as written on the page' },
      } },
    },
  },
  required: ['price'],
}

interface Reading { price: number; currency: string; promotions: unknown; finalUrl: string | null }

async function readPage(url: string, apiKey: string): Promise<Reading> {
  const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      formats: [{ type: 'json', schema: SCHEMA, prompt: 'Read the price and the quantity offers of this Muscle & Strength product page. Use the exact values shown on the page.' }],
      onlyMainContent: false, waitFor: 3000, proxy: 'auto', timeout: 60000,
    }),
    signal: AbortSignal.timeout(90000),
  })
  if (!res.ok) throw new Error(`firecrawl ${res.status}`)
  const body = await res.json().catch(() => null) as { success?: boolean; data?: { json?: { price?: unknown; currency?: unknown; promotions?: unknown }; metadata?: Record<string, unknown> } } | null
  const data = body?.data?.json
  const price = Number(data?.price)
  if (!body?.success || !data || !Number.isFinite(price) || price <= 0) throw new Error('price not found on the page')
  const meta = body.data?.metadata
  const final = typeof meta?.url === 'string' ? meta.url : typeof meta?.sourceURL === 'string' ? meta.sourceURL : null
  return { price: Math.round(price * 100) / 100, currency: String(data.currency ?? 'USD').trim().toUpperCase() || 'USD', promotions: data.promotions, finalUrl: final }
}

interface Row { id: string; name: string; source_url: string; price_htg: number; source_price_usd: number | null }

async function checkOne(admin: ReturnType<typeof createClient>, row: Row, apiKey: string): Promise<{ status: string; note?: string }> {
  const claim = await admin.from('products').update({ price_checked_at: new Date().toISOString() }).eq('id', row.id)
  if (claim.error) return { status: 'error', note: 'claim failed' }
  const fail = async (note: string) => {
    // retried about an hour later by the next run of the job
    await admin.from('price_sync_log').insert({ product_id: row.id, status: 'error', note: note.slice(0, 300) })
    await admin.from('products').update({ price_checked_at: new Date(Date.now() - 19 * 3600_000).toISOString() }).eq('id', row.id)
    return { status: 'error', note }
  }
  try {
    if (!SUPPLIER_PAGE.test(row.source_url)) return await fail('address is not a supplier page')
    const page = await readPage(row.source_url, apiKey)
    if (page.currency !== 'USD') return await fail(`unexpected currency ${page.currency}`)
    // the page must still be this product (a removed product redirects to a category or the home page)
    if (page.finalUrl) {
      const a = new URL(page.finalUrl).pathname.replace(/\/+$/, ''); const b = new URL(row.source_url).pathname.replace(/\/+$/, '')
      if (a !== b) return await fail(`redirected to ${a.slice(0, 120)}`)
    }
    const tiers = promoTiers(page.price, page.promotions)
    // first check: the reference is the supplier price the shop price corresponds to (rate and margin), so a wrong first reading is caught like any big change
    let reference = row.source_price_usd
    if (reference === null) {
      const { data: set } = await admin.from('app_settings').select('key, value').in('key', ['usd_to_htg_rate', 'service_margin_percent'])
      const get = (k: string, fallback: number) => { const v = Number(set?.find((r: { key: string; value: string }) => r.key === k)?.value); return Number.isFinite(v) && v > 0 ? v : fallback }
      reference = impliedUsd(row.price_htg, get('usd_to_htg_rate', 140), get('service_margin_percent', 15))
      if (reference > 0) await admin.from('products').update({ source_price_usd: reference }).eq('id', row.id)
      else reference = null
    }
    if (needsReview(reference, page.price)) {
      const ratio = page.price / (reference as number)
      await admin.from('price_sync_log').insert({
        product_id: row.id, status: 'review', old_usd: reference, new_usd: page.price,
        old_htg: row.price_htg, new_htg: Math.ceil((row.price_htg * ratio) / 5) * 5, promos: tiers,
      })
      return { status: 'review' }
    }
    const { data, error } = await admin.rpc('apply_price_sync', { p_product: row.id, p_new_usd: page.price, p_promos: tiers })
    if (error) return await fail(error.message)
    return { status: String(data) }
  } catch (e) {
    console.error('[price-sync]', row.id, e)
    return await fail(e instanceof Error ? e.message : 'unknown error')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (!apiKey) return json({ error: 'FIRECRAWL_API_KEY missing' }, 503)
    const body = await req.json().catch(() => ({})) as { product_id?: unknown }

    const secret = req.headers.get('x-cron-secret')
    let manual: string | null = null
    if (secret) {
      const { data } = await admin.from('app_settings').select('value').eq('key', 'price_sync_secret').maybeSingle()
      if (!data || data.value !== secret) return json({ error: 'Unauthorized' }, 401)
    } else {
      // an admin checking one product by hand
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return json({ error: 'Unauthorized' }, 401)
      const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) return json({ error: 'Unauthorized' }, 401)
      const asUser = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
      const { data: isStaff } = await asUser.rpc('is_admin')
      if (isStaff !== true) return json({ error: 'Accès réservé à l\'équipe.' }, 403)
      if (typeof body.product_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.product_id)) return json({ error: 'product_id requis' }, 400)
      const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `price-sync:${user.id}`, p_max: 30, p_window_seconds: 3600 })
      if (allowed === false) return json({ error: 'Trop de vérifications, réessayez dans quelques minutes.' }, 429)
      manual = body.product_id
    }

    const columns = 'id, name, source_url, price_htg, source_price_usd'
    let rows: Row[] = []
    if (manual) {
      const { data } = await admin.from('products').select(columns).eq('id', manual).maybeSingle()
      if (!data) return json({ error: 'Produit introuvable' }, 404)
      rows = [data as Row]
    } else {
      // the products waiting for the admin are not read again until he has answered
      const { data: pending } = await admin.from('price_sync_log').select('product_id').eq('status', 'review').is('resolved_at', null)
      const skip = new Set((pending ?? []).map((r: { product_id: string }) => r.product_id))
      const since = new Date(Date.now() - 20 * 3600_000).toISOString()
      const { data } = await admin.from('products').select(columns)
        .eq('price_sync', true).eq('active', true).not('source_url', 'is', null)
        .or(`price_checked_at.is.null,price_checked_at.lt.${since}`)
        .order('price_checked_at', { ascending: true, nullsFirst: true }).limit(BATCH + skip.size)
      rows = ((data ?? []) as Row[]).filter((r) => !skip.has(r.id)).slice(0, BATCH)
    }

    const started = Date.now()
    const results: Array<{ id: string; name: string; status: string; note?: string }> = []
    for (const row of rows) {
      if (Date.now() - started > TIME_BUDGET_MS) break
      results.push({ id: row.id, name: row.name, ...(await checkOne(admin, row, apiKey)) })
    }
    return json({ checked: results.length, results })
  } catch (e) {
    console.error('[price-sync]', e)
    return json({ error: 'Erreur interne' }, 500)
  }
})
