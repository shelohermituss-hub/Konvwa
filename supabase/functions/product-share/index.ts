// Public, read-only data for the link preview of a shared product (name, description, main picture, price).
// Called by the /api/share function of the website for link-preview crawlers (WhatsApp, Facebook…), which cannot sign in.
// Only active, non-wholesale products are returned, and only these public fields.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS })
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return json({ error: 'not_found' }, 404)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data } = await admin.from('products')
    .select('id, name, name_en, description, description_en, images, price_htg, moq, unit, brand, supplier_name, stock_available, active, wholesale_only')
    .eq('id', id).eq('active', true).eq('wholesale_only', false).maybeSingle()
  if (!data) return json({ error: 'not_found' }, 404)

  const images = (Array.isArray(data.images) ? data.images : []).filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u))
  return json({
    id: data.id,
    name: data.name, name_en: data.name_en,
    description: (data.description ?? '').slice(0, 300), description_en: (data.description_en ?? '').slice(0, 300),
    image: images[0] ?? null,
    price_htg: data.price_htg, moq: data.moq, unit: data.unit,
    brand: data.brand || data.supplier_name || null, in_stock: data.stock_available !== false,
  })
})
