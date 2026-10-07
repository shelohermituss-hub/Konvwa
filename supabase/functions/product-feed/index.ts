// Product feed for the Facebook / Instagram catalogue (Commerce Manager > Catalogue > Data sources > Data feed, scheduled every day).
// Public and read-only: only active, non-reseller products with a picture, and only public fields (the same ones the shop shows to everybody).
// The price is the one shown on the product page (HTG): Meta compares both, a page showing another price gets the ads refused.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://konvwa.shop'
const MAX_PRODUCTS = 5000

const COLUMNS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'additional_image_link', 'brand', 'product_type'] as const

/** CSV field: always quoted, quotes doubled; control characters removed. */
const cell = (v: unknown) => `"${String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/"/g, '""')}"`

Deno.serve(async () => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.from('products')
    .select('id, name, description, price_htg, images, brand, supplier_name, category, stock_available')
    .eq('active', true).eq('is_active', true).eq('wholesale_only', false).gt('price_htg', 0)
    .order('created_at', { ascending: false }).limit(MAX_PRODUCTS)
  if (error) return new Response('error', { status: 500 })

  const rows = [COLUMNS.map(cell).join(',')]
  for (const p of data ?? []) {
    const images = (Array.isArray(p.images) ? p.images : []).filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//.test(u))
    if (images.length === 0) continue
    const name = String(p.name ?? '').trim().slice(0, 150)
    if (!name) continue
    rows.push([
      p.id, name, String(p.description ?? '').trim().slice(0, 5000) || name,
      p.stock_available ? 'in stock' : 'out of stock', 'new',
      `${Number(p.price_htg).toFixed(2)} HTG`, `${SITE}/products/${p.id}`,
      images[0], images.slice(1, 11).join(','), p.brand || p.supplier_name || 'KONVWA', p.category ?? '',
    ].map(cell).join(','))
  }
  return new Response(rows.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'public, max-age=900', 'Access-Control-Allow-Origin': '*' },
  })
})
