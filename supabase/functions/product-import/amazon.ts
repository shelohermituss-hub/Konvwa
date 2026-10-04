// Pure helpers for the product-import Edge Function (no Deno API here, so they are unit-tested with vitest).

const FULL_HOST = /^(?:www\.|smile\.|m\.)?(amazon\.(?:com|ca|co\.uk|de|fr|es|it))$/i
const SHORT_HOST = /^(?:a\.co|amzn\.to)$/i
const ASIN_IN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|product|d)\/([A-Za-z0-9]{10})(?=[/?#]|$)/

export interface AmazonTarget {
  /** Marketplace domain without subdomain, e.g. "amazon.com". Empty for a short link (resolved later). */
  domain: string
  asin: string | null
  short: boolean
  url: URL
}

/** An https link to an Amazon marketplace or a short link, without credentials or custom port. */
export function parseAmazonUrl(raw: string): AmazonTarget | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
  const host = url.hostname.toLowerCase()
  if (SHORT_HOST.test(host)) return { domain: '', asin: null, short: true, url }
  const m = FULL_HOST.exec(host)
  if (!m) return null
  const asin = ASIN_IN_PATH.exec(url.pathname)?.[1]?.toUpperCase() ?? null
  return { domain: m[1].toLowerCase(), asin, short: false, url }
}

/** Tracking-free product URL used for the scrape and stored as the product source. */
export function canonicalUrl(domain: string, asin: string): string {
  return `https://www.${domain}/dp/${asin}`
}

const IMAGE_HOST = /^(?:m\.media-amazon\.com|images-(?:na|eu|fe)\.ssl-images-amazon\.com|ecx\.images-amazon\.com)$/i

/** Amazon image URLs only (https, no credentials/port); size modifiers (._AC_SL1500_) are removed to get the original file. */
export function amazonImageUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let url: URL
  try { url = new URL(raw.trim()) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
  if (!IMAGE_HOST.test(url.hostname) || !/\.(jpe?g|png|webp)$/i.test(url.pathname)) return null
  url.pathname = url.pathname.replace(/\._[A-Za-z0-9,_%-]+_(\.(?:jpe?g|png|webp))$/i, '$1')
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Up to `max` distinct, valid Amazon image URLs, order preserved. */
export function pickImages(list: unknown, max = 5): string[] {
  if (!Array.isArray(list)) return []
  const out: string[] = []
  for (const item of list) {
    const u = amazonImageUrl(item)
    if (u && !out.includes(u)) out.push(u)
    if (out.length >= max) break
  }
  return out
}
