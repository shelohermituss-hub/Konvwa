// Platforms the admin can import from. Pure (no Deno API) so it is unit-tested with vitest.
// Anti-SSRF: only exact, https hosts of each platform are accepted (no credentials, no custom port), and only the
// platform's own image hosts are downloaded.
import { amazonImageUrl, canonicalUrl, parseAmazonUrl, type AmazonTarget } from './amazon.ts'

export type PlatformId = 'amazon' | 'shein' | 'alibaba' | 'temu' | 'muscle_strength' | 'walmart' | 'aliexpress' | 'ebay'

export interface Platform {
  id: PlatformId
  name: string
  /** Shipping origin of the supplier; the US ones are sold all inclusive at checkout. */
  country: string
  /** Currency assumed when the page does not say. */
  currency: string
}

export const PLATFORMS: Record<PlatformId, Platform> = {
  amazon: { id: 'amazon', name: 'Amazon', country: 'US', currency: 'USD' },
  shein: { id: 'shein', name: 'Shein', country: 'CN', currency: 'USD' },
  alibaba: { id: 'alibaba', name: 'Alibaba', country: 'CN', currency: 'USD' },
  temu: { id: 'temu', name: 'Temu', country: 'CN', currency: 'USD' },
  muscle_strength: { id: 'muscle_strength', name: 'Muscle & Strength', country: 'US', currency: 'USD' },
  walmart: { id: 'walmart', name: 'Walmart', country: 'US', currency: 'USD' },
  aliexpress: { id: 'aliexpress', name: 'AliExpress', country: 'CN', currency: 'USD' },
  ebay: { id: 'ebay', name: 'eBay', country: 'US', currency: 'USD' },
}

const HOSTS: Array<[Exclude<PlatformId, 'amazon'>, RegExp]> = [
  ['shein', /^(?:www\.|m\.|[a-z]{2,3}\.)?shein\.(?:com|fr|co\.uk|de|es|it|ca|com\.mx|com\.au)$|^shein\.top$|^(?:api-shein|onelink)\.shein\.com$/i],
  ['alibaba', /^(?:www\.|m\.|s\.|[a-z]{2,10}\.)?alibaba\.com$|^detail\.1688\.com$|^m\.1688\.com$/i],
  ['temu', /^(?:www\.|m\.|app\.|share\.)?temu\.com$|^temu\.to$/i],
  ['muscle_strength', /^(?:www\.)?muscleandstrength\.com$/i],
  ['walmart', /^(?:www\.)?walmart\.com$|^walmrt\.us$/i],
  ['aliexpress', /^(?:www\.|m\.|[a-z]{2,3}\.)?aliexpress\.(?:com|us)$|^(?:a|s\.click)\.aliexpress\.com$/i],
  ['ebay', /^(?:www\.|m\.)?ebay\.com$|^ebay\.(?:us|to)$/i],
]

export interface ProductTarget {
  platform: Platform
  /** Tracking-free link used for the scrape and stored as the product source. */
  url: string
  /** Platform product id (ASIN, goods id, slug…) used to name files; null when the link is not a product page. */
  id: string | null
  /** Amazon short links (a.co, amzn.to) must be resolved first. */
  amazon?: AmazonTarget
  /** Share / short links (shein.top, temu.to, share.temu.com, a.co…): the real product page is found by following their redirects. */
  short?: boolean
  /** What an Alibaba "share" page address carries about the product (name, price, picture…): a fallback when the page itself cannot be read. */
  hint?: ShareHint
}

export interface ShareHint { name: string; price: number | null; currency: string; image: string | null; note: string }

/** "8,80 $US", "US $8.80", "€ 7,5" -> number and currency. */
export function parseSharePrice(raw: string | null): { price: number | null; currency: string } {
  const text = (raw ?? '').replace(/\u00a0/g, ' ')
  const m = /(\d+(?:[.,]\d{1,2})?)/.exec(text.replace(/(\d)[ ,](\d{3})(?!\d)/g, '$1$2'))
  const price = m ? Number(m[1].replace(',', '.')) : null
  const currency = /\u20ac|eur/i.test(text) ? 'EUR' : /\u00a5|cny|rmb/i.test(text) ? 'CNY' : 'USD'
  return { price: price !== null && Number.isFinite(price) && price > 0 ? price : null, currency }
}

/** The hosts of the apps' "share" links: they only redirect to the product page. */
const SHORT_HOSTS = /^(?:s\.alibaba\.com|shein\.top|api-shein\.shein\.com|onelink\.shein\.com|temu\.to|share\.temu\.com|app\.temu\.com|walmrt\.us|a\.aliexpress\.com|s\.click\.aliexpress\.com|ebay\.us|ebay\.to)$/i

function cleanHttps(raw: string): URL | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
  return url
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

/** Which platform a link belongs to, its canonical URL and product id; null for any other host or a non-https link. */
export function parseProductUrl(raw: string): ProductTarget | null {
  const amazon = parseAmazonUrl(raw)
  if (amazon) {
    return { platform: PLATFORMS.amazon, url: amazon.asin ? canonicalUrl(amazon.domain, amazon.asin) : amazon.url.toString(), id: amazon.asin, amazon, ...(amazon.short ? { short: true } : {}) }
  }
  const url = cleanHttps(raw)
  if (!url) return null
  const host = url.hostname.toLowerCase()
  const hit = HOSTS.find(([, re]) => re.test(host))
  if (!hit) return null
  const platform = PLATFORMS[hit[0]]
  // a share link keeps its whole address (the code is in the path / query): it is only used to follow its redirects
  if (SHORT_HOSTS.test(host)) return { platform, url: url.toString(), id: null, short: true }
  // Alibaba app / website share links: alibaba.com/x/AbC123?ck=pdp
  if (platform.id === 'alibaba' && /^\/x\/[A-Za-z0-9_-]{3,20}\/?$/.test(url.pathname)) return { platform, url: `https://${host}${url.pathname}`, id: null, short: true }
  // Alibaba "share" page: /share/product-detail.html?productId=…&name=…&price=…&imageUrl=…: the canonical product page is read, the address's own data is kept as a fallback
  if (platform.id === 'alibaba' && /^\/share\/product-detail\.html$/.test(url.pathname)) {
    const pid = url.searchParams.get('productId') ?? ''
    if (/^\d{8,}$/.test(pid)) {
      const { price, currency } = parseSharePrice(url.searchParams.get('price'))
      const name = (url.searchParams.get('name') ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
      const note = [url.searchParams.get('moq'), url.searchParams.get('companyInfo')].filter(Boolean).join(' \u00b7 ').slice(0, 300)
      return {
        platform, id: pid, url: `https://${host}/product-detail/_${pid}.html`,
        hint: { name, price, currency, image: platformImageUrl('alibaba', url.searchParams.get('imageUrl')), note },
      }
    }
  }
  const path = url.pathname
  let id: string | null = null
  const keep = new URLSearchParams()
  if (platform.id === 'shein') {
    id = /-p-(\d{4,})(?:-|\.html)/.exec(path)?.[1] ?? null
  } else if (platform.id === 'alibaba') {
    const q = url.searchParams
    const qid = q.get('productId') ?? q.get('product_id') ?? q.get('id') ?? ''
    id = /\/offer\/(\d{6,})\.html/.exec(path)?.[1] ?? /(\d{8,})\.html$/.exec(path)?.[1] ?? /\/(?:product|item)s?\/(\d{8,})(?:[/.]|$)/.exec(path)?.[1] ?? (/^\d{8,}$/.test(qid) ? qid : null)
  } else if (platform.id === 'temu') {
    const g = url.searchParams.get('goods_id')
    id = /-g-(\d{6,})\.html/.exec(path)?.[1] ?? (g && /^\d{6,}$/.test(g) ? g : null)
    if (g && /^\d{6,}$/.test(g)) keep.set('goods_id', g)
  } else if (platform.id === 'walmart') {
    const wid = /\/ip\/(?:[^/]+\/)?(\d{5,})(?:[/?#]|$)/.exec(path)?.[1] ?? null
    return { platform, url: wid ? `https://www.walmart.com/ip/${wid}` : `https://${host}${path}`, id: wid }
  } else if (platform.id === 'aliexpress') {
    const aid = /\/(?:item|i)\/(?:[^/]+\/)?(\d{8,})\.html$/.exec(path)?.[1] ?? null
    return { platform, url: aid ? `https://www.aliexpress.com/item/${aid}.html` : `https://${host}${path}`, id: aid }
  } else if (platform.id === 'ebay') {
    const eid = /\/itm\/(?:[^/]+\/)?(\d{9,14})(?:[/?#]|$)/.exec(path)?.[1] ?? null
    return { platform, url: eid ? `https://www.ebay.com/itm/${eid}` : `https://${host}${path}`, id: eid }
  } else {
    id = /^\/store\/([a-z0-9][a-z0-9-]*)(?:\.html)?\/?$/i.exec(path) ? slug(path.replace(/^\/store\//, '').replace(/\.html$/, '')) : null
  }
  const q = keep.toString()
  return { platform, url: `https://${host}${path}${q ? `?${q}` : ''}`, id }
}

const IMAGE_HOSTS: Record<PlatformId, RegExp> = {
  amazon: /^$/,
  shein: /(?:^|\.)ltwebstatic\.com$/i,
  alibaba: /(?:^|\.)alicdn\.com$/i,
  temu: /(?:^|\.)kwcdn\.com$/i,
  muscle_strength: /(?:^|\.)muscleandstrength\.com$/i,
  walmart: /(?:^|\.)walmartimages\.com$/i,
  aliexpress: /(?:^|\.)(?:alicdn\.com|aliexpress-media\.com)$/i,
  ebay: /(?:^|\.)ebayimg\.com$/i,
}

/** Size suffixes that thumbnails carry in their file names, removed to get the original picture. */
const SIZE_SUFFIX = [
  /_thumbnail_\d+x\d*(\.[a-z]+)$/i, // Shein
  /(\.(?:jpe?g|png|webp))_\d+x\d+[a-z0-9]*(?:\.(?:jpe?g|png|webp))?$/i, // Alibaba: .jpg_220x220q90.jpg
]

/** A picture URL of the platform's own image hosts (https, jpg/png/webp), or null. Protocol-relative links are accepted. */
export function platformImageUrl(platform: PlatformId, raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (platform === 'amazon') return amazonImageUrl(raw)
  const text = raw.trim().startsWith('//') ? `https:${raw.trim()}` : raw.trim()
  const url = cleanHttps(text)
  if (!url || !IMAGE_HOSTS[platform].test(url.hostname)) return null
  let path = url.pathname
  for (const re of SIZE_SUFFIX) path = path.replace(re, (_m, ext?: string) => ext ?? '')
  // eBay thumbnails (s-l225.jpg) -> the large picture
  if (platform === 'ebay') path = path.replace(/\/s-l\d+\.(jpe?g|png|webp)$/i, '/s-l1600.$1')
  if (!/\.(jpe?g|png|webp)$/i.test(path)) return null
  url.pathname = path
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Up to `max` distinct, valid pictures of the platform, order preserved. */
export function platformImages(platform: PlatformId, list: unknown, max = 5): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const item of list) {
    const u = platformImageUrl(platform, item)
    if (u && !out.includes(u)) out.push(u)
    if (out.length >= max) break
  }
  return out
}

const VIDEO_HOSTS: Partial<Record<PlatformId, RegExp>> = {
  alibaba: /(?:^|\.)(?:alicdn|alibaba)\.com$/i,
}

/** A product video file (https, .mp4 / .webm) hosted by the platform's own domains, or null. Protocol-relative links are accepted. */
export function platformVideoUrl(platform: PlatformId, raw: unknown): string | null {
  const re = VIDEO_HOSTS[platform]
  if (!re || typeof raw !== 'string') return null
  const text = raw.trim().startsWith('//') ? `https:${raw.trim()}` : raw.trim()
  const url = cleanHttps(text)
  if (!url || !re.test(url.hostname) || !/\.(mp4|webm)$/i.test(url.pathname)) return null
  url.hash = ''
  return url.toString().length <= 600 ? url.toString() : null
}

/** The first valid video address found in a page's source (JSON blobs escape slashes as \/ or \u002F). */
export function findVideoUrl(platform: PlatformId, html: unknown): string | null {
  if (typeof html !== 'string') return null
  const text = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&amp;/g, '&')
  for (const m of text.matchAll(/(?:https?:)?\/\/[^\s"'<>\\)]+?\.(?:mp4|webm)(?:\?[^\s"'<>\\)]*)?/gi)) {
    const u = platformVideoUrl(platform, m[0].replace(/^http:/i, 'https:'))
    if (u) return u
  }
  return null
}

/** The product name written in a Shein / Temu product address ("Women-Casual-Dress-p-123-cat-9.html" -> "Women Casual Dress"). */
export function productSlug(url: string): string {
  let path = ''
  try { path = decodeURIComponent(new URL(url).pathname) } catch { return '' }
  const last = path.split('/').filter(Boolean).pop() ?? ''
  return last.replace(/\.html?$/i, '').replace(/-(?:p|g)-\d+.*$/i, '').replace(/[-_]+/g, ' ').trim()
}
