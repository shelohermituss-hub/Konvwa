// Link preview for shared product links. Crawlers (WhatsApp, Facebook, Telegram, X…) do not run the app, so they would only see
// the default KONVWA tags: for them vercel.json routes /products/:id here, and the page carries the product's own picture and name.
// People never land here: they get the app.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://aklwkbzkumcldumrmgmr.supabase.co'
const SITE = 'https://konvwa.shop'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export default async function handler(req, res) {
  const id = String((req.query && req.query.id) || '')
  let p = null
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/product-share?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) })
    if (r.ok) p = await r.json()
  } catch { /* default tags below */ }

  const url = p ? `${SITE}/products/${esc(p.id)}` : SITE
  const title = p ? `${p.name} — KONVWA` : 'KONVWA — Importez depuis Alibaba, Shein et Temu en Haïti'
  const price = p && Number(p.price_htg) > 0 ? `${Number(p.price_htg).toLocaleString('fr-FR')} HTG` : ''
  const desc = p
    ? [price && `À partir de ${price}`, p.description].filter(Boolean).join(' · ').slice(0, 280) || 'Commandez sur KONVWA et payez via MonCash ou NatCash.'
    : 'Commandez depuis n\'importe quelle boutique internationale et payez via MonCash ou NatCash.'
  // the product's own picture; the app icon only when the product has none
  const image = p && p.image ? p.image : `${SITE}/icon-512.png`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  res.status(200).send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="${p ? 'product' : 'website'}">
<meta property="og:site_name" content="KONVWA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${url}">
</head><body><p><a href="${url}">${esc(title)}</a></p></body></html>`)
}
