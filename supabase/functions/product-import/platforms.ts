// Platforms the admin can import from. Pure (no Deno API) so it is unit-tested with vitest.
// Anti-SSRF: only exact, https hosts of each platform are accepted (no credentials, no custom port), and only the
// platform's own image hosts are downloaded.
import { amazonImageUrl, canonicalUrl, parseAmazonUrl, type AmazonTarget } from './amazon.ts'

export type PlatformId = 'amazon' | 'shein' | 'alibaba' | 'temu' | 'muscle_strength'

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
}

const HOSTS: Array<[Exclude<PlatformId, 'amazon'>, RegExp]> = [
  ['shein', /^(?:www\.|m\.|[a-z]{2,3}\.)?shein\.(?:com|fr|co\.uk|de|es|it|ca|com\.mx|com\.au)$|^shein\.top$|^(?:api-shein|onelink)\.shein\.com$/i],
  ['alibaba', /^(?:www\.|m\.|[a-z]{2,10}\.)?alibaba\.com$|^detail\.1688\.com$|^m\.1688\.com$/i],
  ['temu', /^(?:www\.|m\.|app\.|share\.)?temu\.com$|^temu\.to$/i],
  ['muscle_strength', /^(?:www\.)?muscleandstrength\.com$/i],
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
}

/** The hosts of the apps' "share" links: they only redirect to the product page. */
const SHORT_HOSTS = /^(?:shein\.top|api-shein\.shein\.com|onelink\.shein\.com|temu\.to|share\.temu\.com|app\.temu\.com)$/i

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
  const path = url.pathname
  let id: string | null = null
  const keep = new URLSearchParams()
  if (platform.id === 'shein') {
    id = /-p-(\d{4,})(?:-|\.html)/.exec(path)?.[1] ?? null
  } else if (platform.id === 'alibaba') {
    id = /\/offer\/(\d{6,})\.html/.exec(path)?.[1] ?? /(\d{8,})\.html$/.exec(path)?.[1] ?? null
  } else if (platform.id === 'temu') {
    const g = url.searchParams.get('goods_id')
    id = /-g-(\d{6,})\.html/.exec(path)?.[1] ?? (g && /^\d{6,}$/.test(g) ? g : null)
    if (g && /^\d{6,}$/.test(g)) keep.set('goods_id', g)
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
