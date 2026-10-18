// The visual card of a saved product (supplier pictures copied onto KONVWA first, then drawn): used to post it on the networks and to share it on WhatsApp.
import { renderProductCard } from '@/lib/facebook-card'
import { mirrorImages } from '@/lib/facebook-api'
import { discountPct, strikePrice } from '@/lib/product-pricing'
import { toDisplay } from '@/lib/currency'
import { tr } from '@/lib/i18n'

/** Only pictures stored by us can be drawn on the card (CORS) and sent to Facebook / Instagram. */
export const OURS = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\//

export interface CardProduct {
  id: string; name: string; price_htg: number; discount_pct?: number | null; images: string[]
  delivery_days_min: number | null; delivery_days_max: number | null; supplier_verified: boolean; supplier_name?: string | null
}

/** The visual card of the saved product and the pictures it was drawn from (ours, usable as they are). `onStep` tells what is going on. */
export async function buildProductCard(product: CardProduct, opts: { style?: number; onStep?: (step: string) => void } = {}): Promise<{ card: Blob; photos: string[] }> {
  const pct = discountPct(product)
  // supplier pictures that are not stored on KONVWA yet are copied first (the visual is drawn from them)
  const wanted = product.images.filter((u) => /^https:\/\//.test(u)).slice(0, 4)
  const foreign = wanted.filter((u) => !OURS.test(u))
  let copies: Array<string | null> = []
  if (foreign.length > 0) { opts.onStep?.(tr('Copie des photos…')); copies = await mirrorImages(foreign).catch(() => []) }
  const photos = wanted.map((u) => (OURS.test(u) ? u : copies[foreign.indexOf(u)] ?? null)).filter((u): u is string => !!u)
  if (photos.length === 0) throw new Error(tr('Aucune photo du produit n\'a pu être utilisée. Vérifiez que ses photos s\'affichent bien.'))
  opts.onStep?.(tr('Création du visuel…'))
  const card = await renderProductCard({
    name: product.name, priceHtg: product.price_htg, strikeHtg: pct ? strikePrice(product.price_htg, pct) : null, discountPct: pct || null,
    images: photos, deliveryMin: product.delivery_days_min, deliveryMax: product.delivery_days_max, verified: product.supplier_verified,
    priceUsd: toDisplay(product.price_htg, 'USD'), source: product.supplier_name?.trim() || null, style: opts.style,
  })
  return { card, photos }
}

/** A file name made of the product's name. */
export const cardFileName = (name: string) => `konvwa-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'produit'}.jpg`
