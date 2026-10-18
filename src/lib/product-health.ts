// The quality check of the catalogue (admin, Produits > Contrôle qualité): finds the products and variants that are wrong or incomplete and proposes a fix for each.
// Pure functions (the pictures that do not open are found by the browser, see image-probe.ts, and given here): unit-tested.
import { normalizeTiers, type PriceTier } from '@/lib/product-pricing'

export type Severity = 'error' | 'warning' | 'info'
export type IssueCode =
  | 'no_image' | 'bad_image_url' | 'broken_image' | 'variant_broken_image' | 'variant_same_image' | 'variant_foreign_image'
  | 'no_price' | 'variant_no_price' | 'duplicate' | 'no_category' | 'no_description' | 'tiers' | 'no_weight'

/** What one click does to repair the issue. */
export type Fix =
  | { kind: 'deactivate' }
  | { kind: 'set_images'; images: string[] }
  | { kind: 'clear_variant_images'; variantIds: string[] }
  | { kind: 'set_category'; category: string }
  | { kind: 'set_tiers'; tiers: PriceTier[] }

export interface Issue {
  /** Stable, unique: product + code + what it is about. */
  id: string
  productId: string
  code: IssueCode
  severity: Severity
  /** Values the message needs (a count, a name…). */
  params: Array<string | number>
  fix: Fix | null
}

export interface HealthProduct {
  id: string; name: string; price_htg: number; moq: number; images: string[]; category: string | null; description: string | null; active: boolean
  source_url?: string | null; source_asin?: string | null; price_tiers: unknown
  weight_kg?: number | null; length_cm?: number | null; width_cm?: number | null; height_cm?: number | null
  created_at: string
}
export interface HealthVariant { id: string; product_id: string; label: string; group_name: string | null; image: string | null; price_htg: number }

export const SEVERITY: Record<IssueCode, Severity> = {
  no_image: 'error', broken_image: 'error', no_price: 'error', duplicate: 'error',
  bad_image_url: 'warning', variant_broken_image: 'warning', variant_same_image: 'warning', variant_foreign_image: 'warning', variant_no_price: 'warning', tiers: 'warning', no_category: 'warning',
  no_description: 'info', no_weight: 'info',
}

const HTTPS = /^https:\/\/[^\s/$.?#][^\s]*$/i
/** A picture served by the site itself (`/images/x.jpg`). */
const OWN = /^\/(?!\/)[^\s]+$/

/** An image link that a browser can use: https (or a path of the site itself), no spaces. */
export const isImageUrl = (u: unknown): u is string => typeof u === 'string' && (HTTPS.test(u.trim()) || OWN.test(u.trim()))

/** The site a link points to without its subdomain (`sc04.alicdn.com` and `img.alicdn.com` are the same site). */
export function siteOf(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase()
    const parts = host.split('.')
    return parts.length <= 2 ? host : parts.slice(-2).join('.')
  } catch { return '' }
}

/** A name reduced to what makes two products "the same": lower case, no accents, no punctuation. */
const nameKey = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const STOP = new Set(['avec', 'pour', 'sans', 'dans', 'plus', 'tres', 'les', 'des', 'une', 'the', 'and', 'for', 'with', 'new', 'pcs', 'set', 'pack', 'lot'])
const tokens = (s: string) => [...new Set(nameKey(s).split(' ').filter((t) => t.length >= 4 && !STOP.has(t) && !/^\d+$/.test(t)))]

/** The category the other products suggest for a name: the one that its words are most tied to, when that is clear. */
export function suggestCategory(name: string, catalogue: Array<{ name: string; category: string | null }>): string | null {
  const byToken = new Map<string, Map<string, number>>()
  for (const p of catalogue) {
    const cat = p.category?.trim()
    if (!cat) continue
    for (const t of tokens(p.name)) {
      const m = byToken.get(t) ?? new Map<string, number>()
      m.set(cat, (m.get(cat) ?? 0) + 1)
      byToken.set(t, m)
    }
  }
  const score = new Map<string, number>()
  for (const t of tokens(name)) {
    const m = byToken.get(t)
    if (!m) continue
    const total = [...m.values()].reduce((a, b) => a + b, 0)
    if (total < 2) continue
    for (const [cat, n] of m) score.set(cat, (score.get(cat) ?? 0) + n / total)
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length === 0 || ranked[0][1] < 0.9) return null
  if (ranked.length > 1 && ranked[0][1] - ranked[1][1] < 0.5) return null
  return ranked[0][0]
}

export interface AnalyzeOptions {
  /** Picture links the browser could not open (see image-probe.ts). */
  broken?: ReadonlySet<string>
}

/** Every issue of the catalogue, errors first. */
export function analyzeCatalogue(products: HealthProduct[], variants: HealthVariant[], opts: AnalyzeOptions = {}): Issue[] {
  const broken = opts.broken ?? new Set<string>()
  const out: Issue[] = []
  const add = (p: HealthProduct, code: IssueCode, what: string, params: Array<string | number>, fix: Fix | null) =>
    out.push({ id: `${p.id}:${code}:${what}`, productId: p.id, code, severity: SEVERITY[code], params, fix })

  const variantsOf = new Map<string, HealthVariant[]>()
  for (const v of variants) variantsOf.set(v.product_id, [...(variantsOf.get(v.product_id) ?? []), v])

  // duplicates: the same name or the same supplier page; the oldest product (or the one with more pictures) stays
  const groups = new Map<string, HealthProduct[]>()
  for (const p of products) {
    const keys = [`n:${nameKey(p.name)}`, p.source_url ? `u:${p.source_url.trim().toLowerCase().replace(/[?#].*$/, '')}` : '', p.source_asin ? `a:${p.source_asin.trim().toLowerCase()}` : ''].filter((k) => k.length > 2)
    for (const k of keys) groups.set(k, [...(groups.get(k) ?? []), p])
  }
  const dupOf = new Map<string, string>()
  for (const list of groups.values()) {
    if (list.length < 2) continue
    const keep = [...list].sort((a, b) => Number(b.active) - Number(a.active) || b.images.length - a.images.length || a.created_at.localeCompare(b.created_at))[0]
    for (const p of list) if (p.id !== keep.id && !dupOf.has(p.id)) dupOf.set(p.id, keep.name)
  }

  for (const p of products) {
    const urls = (p.images ?? []).map((u) => String(u ?? '').trim())
    const good = [...new Set(urls.filter(isImageUrl))]
    const badUrls = urls.length - good.length
    const repeated = good.length < urls.filter(isImageUrl).length
    const down = good.filter((u) => broken.has(u))
    const usable = good.filter((u) => !broken.has(u))

    if (p.active && usable.length === 0) add(p, 'no_image', '', [], { kind: 'deactivate' })
    if (badUrls > 0 || repeated) add(p, 'bad_image_url', '', [badUrls + (urls.filter(isImageUrl).length - good.length)], { kind: 'set_images', images: usable })
    if (down.length > 0) add(p, 'broken_image', '', [down.length, good.length], usable.length > 0 ? { kind: 'set_images', images: usable } : { kind: 'deactivate' })

    if (!(p.price_htg > 0)) add(p, 'no_price', '', [], p.active ? { kind: 'deactivate' } : null)
    const dup = dupOf.get(p.id)
    if (dup !== undefined) add(p, 'duplicate', '', [dup], p.active ? { kind: 'deactivate' } : null)

    if (!p.category?.trim()) {
      const s = suggestCategory(p.name, products)
      add(p, 'no_category', '', s ? [s] : [], s ? { kind: 'set_category', category: s } : null)
    }
    if (!p.description?.trim()) add(p, 'no_description', '', [], null)
    if (!(Number(p.weight_kg) > 0) && !(Number(p.length_cm) > 0 && Number(p.width_cm) > 0 && Number(p.height_cm) > 0)) add(p, 'no_weight', '', [], null)

    const rawTiers = Array.isArray(p.price_tiers) ? (p.price_tiers as unknown[]) : []
    if (rawTiers.length > 0) {
      const clean = normalizeTiers(p.price_tiers).filter((t) => t.src === 'sync' || (t.min_qty > p.moq && t.price_htg < p.price_htg))
      if (clean.length !== rawTiers.length) add(p, 'tiers', '', [rawTiers.length - clean.length], { kind: 'set_tiers', tiers: clean })
    }

    // variants: their pictures, and their prices
    const vs = variantsOf.get(p.id) ?? []
    const sites = new Set(usable.map(siteOf).filter(Boolean))
    const byImage = new Map<string, HealthVariant[]>()
    for (const v of vs) if (isImageUrl(v.image)) byImage.set(v.image.trim(), [...(byImage.get(v.image.trim()) ?? []), v])
    const downV = vs.filter((v) => isImageUrl(v.image) && broken.has(v.image.trim()))
    if (downV.length > 0) add(p, 'variant_broken_image', '', [downV.length], { kind: 'clear_variant_images', variantIds: downV.map((v) => v.id) })
    // the same picture on variants that are different choices (two colours, two sizes…): at least one of them shows the wrong thing
    const same: HealthVariant[] = []
    for (const list of byImage.values()) {
      const labels = new Set(list.map((v) => nameKey(v.label)))
      if (list.length >= 2 && labels.size >= 2) same.push(...list.slice(1))
    }
    if (same.length > 0) add(p, 'variant_same_image', '', [same.length], { kind: 'clear_variant_images', variantIds: same.map((v) => v.id) })
    // a picture from another site than the product's own pictures: usually a wrong link picked up at import
    if (sites.size > 0) {
      const foreign = vs.filter((v) => isImageUrl(v.image) && !broken.has(v.image.trim()) && !sites.has(siteOf(v.image.trim())))
      if (foreign.length > 0) add(p, 'variant_foreign_image', '', [foreign.length], { kind: 'clear_variant_images', variantIds: foreign.map((v) => v.id) })
    }
    const noPrice = vs.filter((v) => !(Number(v.price_htg) > 0))
    if (noPrice.length > 0) add(p, 'variant_no_price', '', [noPrice.length], null)
  }

  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

/** The fixes that can be applied without a second look: they only clean data that is certainly wrong (unusable links, pictures that do not open, empty products). */
export const SAFE_FIXES: ReadonlySet<IssueCode> = new Set(['bad_image_url', 'broken_image', 'variant_broken_image', 'tiers', 'no_image'])
