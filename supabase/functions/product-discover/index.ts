// Admin tool: finds trending / best-selling products and returns up to 20 candidates that are not yet in the shop: Amazon's public ranking pages, popular Alibaba
// products and Muscle & Strength's "best of" pages (read with Firecrawl), or Neewer's own best-seller collections (read directly, it is a Shopify store).
// The products themselves are imported afterwards, one by one, by `product-import`.
// Secret (Edge Function secrets): FIRECRAWL_API_KEY (not needed for Neewer).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { discoverUrl, extractCandidates, isKnown, knownPattern, neewerCandidates, neewerTopicFilter } from './discover.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_COUNT = 20

const SCHEMA = {
  type: 'object',
  properties: {
    products: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full product page address' },
          title: { type: 'string', description: 'Full product name' },
          image_url: { type: 'string', description: 'Main product picture address' },
          price_usd: { type: 'number', description: 'Lowest displayed price in US dollars' },
          rating: { type: 'number', description: 'Star rating out of 5' },
          reviews: { type: 'number', description: 'Number of ratings' },
        },
      },
    },
  },
}
const PROMPT = 'List every product shown on this page, in page order, with its product page URL, full name, main picture URL, lowest price in USD, star rating and number of ratings (leave out what is not shown).'

interface Page { links: unknown; markdown: unknown; products: unknown }

/** The page: its markdown, every link on it and a structured product list, scrolled so that the lazy-loaded rows are there. */
async function readPage(url: string, apiKey: string): Promise<Page | null> {
  const scroll = Array.from({ length: 5 }, () => [{ type: 'scroll', direction: 'down' }, { type: 'wait', milliseconds: 700 }]).flat()
  const json = { type: 'json', prompt: PROMPT, schema: SCHEMA }
  const attempts: Array<{ actions?: unknown[]; formats: unknown[] }> = [
    { actions: [{ type: 'wait', milliseconds: 1200 }, ...scroll], formats: ['markdown', 'links', json] },
    { formats: ['markdown', 'links', json] },
    { formats: ['markdown', 'links'] },
  ]
  for (const a of attempts) {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // read as from the US in English: elsewhere Alibaba switches to a language site whose links have another shape
      body: JSON.stringify({ url, formats: a.formats, onlyMainContent: false, proxy: 'auto', location: { country: 'US', languages: ['en-US'] }, timeout: 90000, ...(a.actions ? { actions: a.actions } : { waitFor: 3000 }) }),
      signal: AbortSignal.timeout(110000),
    }).catch(() => null)
    if (!res) continue
    if (!res.ok) { console.error('[product-discover] firecrawl', res.status, (await res.text().catch(() => '')).slice(0, 300)); continue }
    const body = await res.json().catch(() => null) as { success?: boolean; data?: { markdown?: string; links?: string[]; json?: { products?: unknown } } } | null
    if (body?.success && body.data) return { links: body.data.links, markdown: body.data.markdown, products: body.data.json?.products }
  }
  return null
}

/** Neewer's collection (public Shopify JSON): its products, or null when the shop cannot be read. */
async function readNeewer(url: string, pages = 1): Promise<unknown[] | null> {
  const one = async (page: number) => {
    const res = await fetch(pages > 1 ? `${url}&page=${page}` : url, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } }).catch(() => null)
    if (!res?.ok || new URL(res.url).hostname.replace(/^www\./, '') !== 'neewer.com') { await res?.body?.cancel().catch(() => {}); return null }
    const body = await res.json().catch(() => null) as { products?: unknown } | null
    return Array.isArray(body?.products) ? body.products : null
  }
  const lists = await Promise.all(Array.from({ length: pages }, (_, i) => one(i + 1)))
  // the first page must be readable; a later page that is missing just ends the list
  return lists[0] ? lists.flatMap((l) => l ?? []) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const supaUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    // staff only: is_admin() is evaluated with the caller's own token (it also enforces the MFA rule)
    const asUser = createClient(supaUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: isStaff } = await asUser.rpc('is_admin')
    if (isStaff !== true) return json({ error: 'Accès réservé à l\'équipe.' }, 403)

    const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `product-discover:${user.id}`, p_max: 20, p_window_seconds: 3600 })
    if (allowed === false) return json({ error: 'Trop de recherches, réessayez dans quelques minutes.' }, 429)

    const body = await req.json().catch(() => ({})) as { source?: unknown; department?: unknown; count?: unknown }
    const url = discoverUrl(String(body.source ?? ''), String(body.department ?? ''))
    if (!url) return json({ error: 'Source ou rayon inconnu.' }, 400)
    const count = Math.min(MAX_COUNT, Math.max(1, Math.floor(Number(body.count) || MAX_COUNT)))

    let found
    if (body.source === 'neewer') {
      const department = String(body.department ?? '')
      const topic = url.includes('/collections/all-product/')
      const products = await readNeewer(url, topic ? 3 : 1)
      if (!products) return json({ error: 'La boutique Neewer n\'a pas pu être lue pour le moment (collection introuvable ?). Réessayez dans un instant.', code: 'unreadable' }, 502)
      found = neewerCandidates(neewerTopicFilter(products, department), 60)
    } else {
      const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
      if (!firecrawlKey) return json({ error: 'Outil non configuré : ajoutez le secret FIRECRAWL_API_KEY dans Supabase (Edge Functions > Secrets).', code: 'not_configured' }, 503)
      const page = await readPage(url, firecrawlKey)
      if (!page) return json({ error: 'La page n\'a pas pu être lue pour le moment (page bloquée ou indisponible). Réessayez dans un instant.', code: 'unreadable' }, 502)
      found = extractCandidates(page.links, page.markdown, 60, page.products)
    }
    if (found.length === 0) return json({ error: 'Aucun produit trouvé sur cette page. Essayez un autre rayon.', code: 'empty' }, 502)

    // products already in the shop (whatever their state) are not proposed again
    const ids = found.map((c) => c.asin)
    const { data: known } = await admin.from('products').select('source_asin, source_url').or(`source_asin.in.(${ids.join(',')}),${found.map((c) => `source_url.ilike.${knownPattern(c)}`).join(',')}`)
    const have = new Set<string>()
    for (const k of (known ?? []) as Array<{ source_asin: string | null; source_url: string | null }>) {
      if (k.source_asin) have.add(k.source_asin)
      for (const c of found) if (isKnown(k.source_url, c)) have.add(c.asin)
    }
    const fresh = found.filter((c) => !have.has(c.asin))
    console.log('[product-discover]', body.source, String(body.department ?? ''), `found=${found.length} new=${fresh.length}`)
    return json({ candidates: fresh.slice(0, count), skipped_existing: found.length - fresh.length, total_found: found.length, page: url })
  } catch (e) {
    console.error('[product-discover]', e)
    return json({ error: 'Erreur interne' }, 500)
  }
})
