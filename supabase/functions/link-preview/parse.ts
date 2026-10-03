// Pure helpers for the link-preview Edge Function (no Deno API here, so they are unit-tested with vitest).

export type Platform = 'alibaba' | 'shein' | 'temu'

const HOSTS: Array<{ platform: Platform; test: RegExp }> = [
  { platform: 'alibaba', test: /(^|\.)alibaba\.com$/i },
  { platform: 'alibaba', test: /(^|\.)1688\.com$/i },
  { platform: 'shein', test: /(^|\.)shein\.com$/i },
  { platform: 'shein', test: /(^|\.)shein\.top$/i },
  { platform: 'temu', test: /(^|\.)temu\.com$/i },
]

/** Returns the platform when the URL is an https link to an allowed shop (no credentials, no custom port). */
export function allowedPlatform(raw: string): { platform: Platform; url: URL } | null {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
  const hit = HOSTS.find((h) => h.test.test(url.hostname))
  return hit ? { platform: hit.platform, url } : null
}

/** An image may come from any public CDN, but never from an IP address, localhost or an internal name. */
export function safeImageUrl(raw: string | null | undefined, base?: string): string | null {
  if (!raw) return null
  let url: URL
  try { url = new URL(raw.startsWith('//') ? `https:${raw}` : raw, base) } catch { return null }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return null
  if (!host.includes('.') || /^\d+(\.\d+){3}$/.test(host) || host.includes(':')) return null
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null
  return url.toString()
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }
function decode(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.:]/g, '\\$&')}["'][^>]*>`, 'i')
  const tag = html.match(re)?.[0]
  if (!tag) return null
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1]
  return content ? decode(content).trim() : null
}

function jsonLdProduct(html: string): { name?: string; image?: string; price?: number; currency?: string } {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const [, body] of blocks) {
    let data: unknown
    try { data = JSON.parse(body) } catch { continue }
    const nodes: unknown[] = Array.isArray(data) ? data : [data, ...(Array.isArray((data as { '@graph'?: unknown[] })?.['@graph']) ? (data as { '@graph': unknown[] })['@graph'] : [])]
    for (const node of nodes) {
      const n = node as { '@type'?: string | string[]; name?: string; image?: unknown; offers?: unknown }
      const types = ([] as string[]).concat(n?.['@type'] ?? [])
      if (!types.includes('Product')) continue
      const offers = ([] as Array<{ price?: unknown; lowPrice?: unknown; priceCurrency?: string }>).concat((n.offers as never) ?? [])
      const offer = offers[0]
      const price = Number(offer?.price ?? offer?.lowPrice)
      const img = Array.isArray(n.image) ? n.image[0] : n.image
      return {
        name: typeof n.name === 'string' ? n.name : undefined,
        image: typeof img === 'string' ? img : (img as { url?: string } | undefined)?.url,
        price: Number.isFinite(price) && price > 0 ? price : undefined,
        currency: offer?.priceCurrency,
      }
    }
  }
  return {}
}

const SITE_SUFFIX = /\s*[-|–—]\s*(alibaba\.com|alibaba|shein[^-|]*|temu[^-|]*|1688\.com)\s*$/i
function cleanName(name: string): string {
  return decode(name).replace(SITE_SUFFIX, '').replace(/\s+/g, ' ').trim().slice(0, 200)
}

/** A readable name from the product URL (works even when the page cannot be read). */
export function nameFromUrl(url: URL): string | null {
  const last = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
    .replace(/\.html?$/i, '')
    .replace(/_\d{6,}$/, '')            // alibaba: ..._1600123456789
    .replace(/-p-\d+.*$/i, '')          // shein: ...-p-12345-cat-1727
    .replace(/-g-\d+.*$/i, '')          // temu: ...-g-601099512345678
    .replace(/^-+/, '')
  const words = last.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (words.length < 3 || /^\d+$/.test(words)) return null
  return words.charAt(0).toUpperCase() + words.slice(1, 200)
}

export interface Preview {
  name: string | null
  image: string | null
  price: number | null
  currency: string | null
}

export function parsePreview(html: string, pageUrl: URL): Preview {
  const ld = jsonLdProduct(html)
  const title = metaContent(html, 'og:title') ?? ld.name ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
  const image = safeImageUrl(metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image') ?? ld.image, pageUrl.toString())
  const metaPrice = Number(metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount'))
  const price = Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : ld.price ?? null
  const currency = (metaContent(html, 'product:price:currency') ?? metaContent(html, 'og:price:currency') ?? ld.currency ?? null)?.toUpperCase() ?? null
  return {
    name: title ? cleanName(title) || null : nameFromUrl(pageUrl),
    image,
    price: price ?? null,
    currency: price ? currency : null,
  }
}
