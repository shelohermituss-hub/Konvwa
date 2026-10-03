import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { allowedPlatform, nameFromUrl, parsePreview, safeImageUrl } from './parse.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const MAX_PAGE = 1_500_000
const MAX_IMAGE = 4_000_000
const MAX_HOPS = 4

/** Reads at most `limit` bytes so a huge response cannot exhaust memory. */
async function readLimited(res: Response, limit: number): Promise<Uint8Array> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < limit) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => {})
  const out = new Uint8Array(Math.min(total, limit))
  let offset = 0
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, out.length - offset))
    out.set(slice, offset)
    offset += slice.length
  }
  return out
}

/** Follows redirects by hand: every hop must stay on an allowed shop (no open redirect to internal hosts). */
async function fetchPage(start: URL): Promise<{ html: string; url: URL } | null> {
  let url = start
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-US,en;q=0.9' },
    })
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location')
      const target = next ? allowedPlatform(new URL(next, url).toString()) : null
      if (!target) return null
      url = target.url
      continue
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null
    const bytes = await readLimited(res, MAX_PAGE)
    return { html: new TextDecoder().decode(bytes), url }
  }
  return null
}

async function storeImage(admin: ReturnType<typeof createClient>, userId: string, imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA }, redirect: 'error' })
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type]
    if (!res.ok || !ext) return null
    const bytes = await readLimited(res, MAX_IMAGE)
    if (bytes.length < 500 || bytes.length >= MAX_IMAGE) return null
    const path = `${userId}/link-${Date.now()}.${ext}`
    const { error } = await admin.storage.from('product-images').upload(path, bytes, { contentType: type, upsert: false })
    if (error) return null
    return admin.storage.from('product-images').getPublicUrl(path).data.publicUrl
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: allowed } = await admin.rpc('check_rate_limit', { p_key: `link-preview:${user.id}`, p_max: 20, p_window_seconds: 600 })
    if (allowed === false) return json({ error: 'Trop de requêtes, réessayez dans quelques minutes.' }, 429)

    const body = await req.json().catch(() => ({})) as { url?: unknown }
    const target = typeof body.url === 'string' && body.url.length <= 2000 ? allowedPlatform(body.url.trim()) : null
    if (!target) return json({ error: 'Lien non pris en charge (Alibaba, Shein ou Temu).' }, 400)

    const page = await fetchPage(target.url).catch(() => null)
    const preview = page ? parsePreview(page.html, page.url) : { name: nameFromUrl(target.url), image: null, price: null, currency: null }
    const safe = safeImageUrl(preview.image)
    const image = safe ? await storeImage(admin, user.id, safe) : null

    return json({
      platform: target.platform,
      name: preview.name,
      image_url: image,
      price: preview.price,
      currency: preview.currency,
      page_read: !!page,
    })
  } catch (e) {
    console.error('[link-preview]', e)
    return json({ error: 'Erreur interne' }, 500)
  }
})
