// Admin tool: finds trending / best-selling Amazon products (Amazon's public ranking pages, read with Firecrawl) and returns up to 20
// candidates that are not yet in the shop. The products themselves are imported afterwards, one by one, by `product-import`.
// Secret (Edge Function secrets): FIRECRAWL_API_KEY.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { discoverUrl, extractCandidates } from './discover.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_COUNT = 20

/** The ranking page: its markdown (titles, stars, prices) and every link on it, scrolled so that the lazy-loaded rows are there. */
async function readRanking(url: string, apiKey: string): Promise<{ links: unknown; markdown: unknown } | null> {
  const scroll = Array.from({ length: 5 }, () => [{ type: 'scroll', direction: 'down' }, { type: 'wait', milliseconds: 700 }]).flat()
  for (const actions of [[{ type: 'wait', milliseconds: 1200 }, ...scroll], undefined]) {
    const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown', 'links'], onlyMainContent: false, proxy: 'auto', timeout: 60000, ...(actions ? { actions } : { waitFor: 3000 }) }),
      signal: AbortSignal.timeout(90000),
    }).catch(() => null)
    if (!res) continue
    if (!res.ok) { console.error('[product-discover] firecrawl', res.status, (await res.text().catch(() => '')).slice(0, 300)); continue }
    const body = await res.json().catch(() => null) as { success?: boolean; data?: { markdown?: string; links?: string[] } } | null
    if (body?.success && body.data) return { links: body.data.links, markdown: body.data.markdown }
  }
  return null
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

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
    if (!firecrawlKey) return json({ error: 'Outil non configuré : ajoutez le secret FIRECRAWL_API_KEY dans Supabase (Edge Functions > Secrets).', code: 'not_configured' }, 503)

    const page = await readRanking(url, firecrawlKey)
    if (!page) return json({ error: 'Amazon n\'a pas pu être lu pour le moment (page bloquée ou indisponible). Réessayez dans un instant.', code: 'unreadable' }, 502)
    const found = extractCandidates(page.links, page.markdown)
    if (found.length === 0) return json({ error: 'Aucun produit trouvé sur cette page. Essayez un autre rayon.', code: 'empty' }, 502)

    // products already in the shop (whatever their state) are not proposed again
    const asins = found.map((c) => c.asin)
    const { data: known } = await admin.from('products').select('source_asin, source_url').or(`source_asin.in.(${asins.join(',')}),${asins.map((a) => `source_url.ilike.%${a}%`).join(',')}`)
    const have = new Set<string>()
    for (const k of (known ?? []) as Array<{ source_asin: string | null; source_url: string | null }>) {
      if (k.source_asin) have.add(k.source_asin)
      const m = /\/dp\/([A-Z0-9]{10})/.exec(k.source_url ?? '')
      if (m) have.add(m[1])
    }
    const fresh = found.filter((c) => !have.has(c.asin))
    return json({ candidates: fresh.slice(0, count), skipped_existing: found.length - fresh.length, total_found: found.length, page: url })
  } catch (e) {
    console.error('[product-discover]', e)
    return json({ error: 'Erreur interne' }, 500)
  }
})
