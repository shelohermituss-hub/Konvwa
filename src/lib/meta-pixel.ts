// Meta (Facebook / Instagram) Pixel: tells Meta which products people look at, add to the cart and buy, so the catalogue ads can show
// each person the right products. Off until the Pixel id is set (VITE_META_PIXEL_ID on Vercel, public by nature), so nothing loads without it.
const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ?? ''

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: (...args: unknown[]) => void }
declare global { interface Window { fbq?: Fbq; _fbq?: Fbq } }

export const pixelEnabled = /^\d{6,20}$/.test(PIXEL_ID)

export function initPixel(): void {
  if (!pixelEnabled || window.fbq) return
  const fbq: Fbq = function (...args: unknown[]) { if (fbq.callMethod) fbq.callMethod(...args); else (fbq.queue ??= []).push(args) }
  window.fbq = fbq; window._fbq = fbq; fbq.loaded = true
  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('init', PIXEL_ID)
  fbq('track', 'PageView')
}

/** A standard event of the Pixel (ViewContent, AddToCart, InitiateCheckout, Purchase…); nothing happens when the Pixel is off. */
export function trackPixel(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (!pixelEnabled) return
  try { window.fbq?.('track', event, params ?? {}, eventId ? { eventID: eventId } : undefined) } catch { /* blocked by the browser */ }
}

/** Product data in the shape Meta expects: the ids are the ones of the catalogue feed (the product id), the price is the selling price. */
export function productParams(product: { id: string; name: string }, valueHtg: number, quantity = 1): Record<string, unknown> {
  return { content_type: 'product', content_ids: [product.id], content_name: product.name, contents: [{ id: product.id, quantity }], value: valueHtg, currency: 'HTG' }
}
