// Southood (Shopify store): variants and price from the product's `.js` JSON, extra options from the product-options app data (`var bcpo_data=`) in the page.
// Pure: unit-tested with vitest. The prices KONVWA sells the options at are fixed here (they replace the shop's own supplements).

/** Pictures of the shop (Shopify CDN) and of its options app (CloudFront, addresses without extension). */
const IMAGE_URL = /^https:\/\/(?:cdn\.shopify\.com|d17fzo7x83uajt\.cloudfront\.net)\/\S+$/

export const southoodImage = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null
  const u = raw.trim().startsWith('//') ? `https:${raw.trim()}` : raw.trim()
  return IMAGE_URL.test(u) && u.length <= 600 ? u : null
}

export interface ShopVariant { group_name: string | null; label: string; price_usd: number; image: string | null; in_stock: boolean }
export interface ShopOption { label: string; label_en: string; image: string | null; price_usd: number }
export interface ShopGroup {
  name: string
  name_en: string
  required: boolean
  multi: boolean
  /** Index (in the returned list) of the group that must have a choice for this one to be shown. */
  show_when: number | null
  /** Indexes (in the options of the `show_when` group) of the only choices that show this group; empty = any choice. */
  show_when_options: number[]
  options: ShopOption[]
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Variants, pictures and prices of `/products/<handle>.js` (prices are in cents). */
export function parseShopifyProduct(raw: unknown): { variants: ShopVariant[]; images: string[]; price_usd: number | null; compare_usd: number | null } {
  const p = obj(raw)
  const groupName = text(arr(p.options).map((o) => (typeof o === 'string' ? o : text(obj(o).name)))[0]) || null
  const variants: ShopVariant[] = []
  const seen = new Set<string>()
  for (const v of arr(p.variants).map(obj)) {
    const label = text(v.option1) || text(v.title)
    const cents = Number(v.price)
    if (!label || label === 'Default Title' || !(cents > 0) || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    variants.push({ group_name: groupName, label: label.slice(0, 120), price_usd: Math.round(cents) / 100, image: southoodImage(obj(v.featured_image).src), in_stock: v.available !== false })
  }
  const prices = arr(p.variants).map((v) => Number(obj(v).price)).filter((n) => n > 0)
  const compares = arr(p.variants).map((v) => Number(obj(v).compare_at_price)).filter((n) => n > 0)
  return {
    variants,
    images: arr(p.images).map(southoodImage).filter((u): u is string => !!u),
    price_usd: prices.length ? Math.min(...prices) / 100 : null,
    compare_usd: compares.length ? Math.max(...compares) / 100 : null,
  }
}

/** Discount shown on the shop (struck price vs price) as a whole percentage, or null when it is not worth showing. */
export function discountFrom(price: number | null, compare: number | null): number | null {
  if (!price || !compare || compare <= price) return null
  const pct = Math.round((1 - price / compare) * 100)
  return pct >= 5 && pct <= 90 ? pct : null
}

/** The `bcpo_data` object of the page (found by matching braces: the page source follows it with more code). */
export function extractBcpo(html: string): Record<string, unknown> | null {
  const start = html.indexOf('var bcpo_data=')
  if (start < 0) return null
  const open = html.indexOf('{', start)
  let depth = 0, inStr = false, esc = false
  for (let i = open; i < html.length && i - open < 3_000_000; i++) {
    const c = html[i]
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try { return obj(JSON.parse(html.slice(open, i + 1))) } catch { return null }
    }
  }
  return null
}

// KONVWA's own price list, in USD per unit (the shop's supplements are much higher)
const PRICE_ANTI_BLUE = 19.99
const PRICE_PHOTOCHROMIC = 49.99
const PRICE_ANTI_BLUE_PHOTOCHROMIC = 89.99
const PRICE_POWER = 5.99
const PRICE_CASE = 9.99

/**
 * The options KONVWA sells for a Southood frame: lenses (3 kinds), prescription power (shown once a lens is chosen) and the cases.
 * Everything else the shop offers (tinted, polarized, prescriptions, lens index…) is left out for now.
 */
export function southoodGroups(bcpo: Record<string, unknown> | null): ShopGroup[] {
  const virtual = arr(bcpo?.virtual_options).map(obj)
  const values = (g: Record<string, unknown>) => arr(g.values).map(obj)
  const groups: ShopGroup[] = []

  const lensType = virtual.find((g) => text(g.title).toLowerCase() === 'lens type')
  if (lensType) {
    const keys = values(lensType).map((v) => text(v.key))
    const lenses: ShopOption[] = []
    if (keys.some((k) => /^anti-blue\s*light$/i.test(k))) lenses.push({ label: 'Anti-lumière bleue', label_en: 'Anti-blue light', image: null, price_usd: PRICE_ANTI_BLUE })
    if (keys.some((k) => /^\W*photochromic$/i.test(k))) lenses.push({ label: 'Photochromique', label_en: 'Photochromic', image: null, price_usd: PRICE_PHOTOCHROMIC })
    if (keys.some((k) => /^anti-blue\+photochromic$/i.test(k))) lenses.push({ label: 'Anti-lumière bleue + photochromique', label_en: 'Anti-blue + photochromic', image: null, price_usd: PRICE_ANTI_BLUE_PHOTOCHROMIC })
    if (lenses.length > 0) groups.push({ name: 'Verres', name_en: 'Lenses', required: false, multi: false, show_when: null, show_when_options: [], options: lenses })
    // the photochromic lenses (alone, and with the anti-blue layer) take a colour, shown as a swatch
    const colours = photochromicColours(virtual)
    const photoAt = lenses.map((l, i) => (/photochrom/i.test(l.label_en) ? i : -1)).filter((i) => i >= 0)
    if (colours.length > 0 && photoAt.length > 0) groups.push({ name: 'Couleur du verre photochromique', name_en: 'Photochromic lens colour', required: true, multi: false, show_when: 0, show_when_options: photoAt, options: colours })
  }

  const power = virtual.find((g) => text(g.title).toLowerCase() === 'reading glasses')
  if (power && groups.length > 0) {
    const options = values(power).map((v) => text(v.key)).filter((k) => /^[+-]?\d{2,3}$/.test(k))
      .map((k) => ({ label: k, label_en: k, image: null, price_usd: PRICE_POWER }))
    if (options.length > 0) groups.push({ name: 'Puissance du verre', name_en: 'Lens power', required: false, multi: false, show_when: 0, show_when_options: [], options })
  }

  const cases = virtual.find((g) => /frequently bought together/i.test(text(g.title)))
  if (cases) {
    const options = values(cases).map((v) => ({ key: text(v.key), image: southoodImage(v.value) })).filter((v) => v.key)
      .map((v) => ({ label: CASE_FR[v.key.toLowerCase()] ?? v.key, label_en: v.key, image: v.image, price_usd: PRICE_CASE }))
    if (options.length > 0) groups.push({ name: 'Étui', name_en: 'Case', required: false, multi: true, show_when: null, show_when_options: [], options })
  }
  return groups
}

const COLOUR_FR: Record<string, string> = { gray: 'Gris', brown: 'Marron', blue: 'Bleu', purple: 'Violet', pink: 'Rose', green: 'Vert', orange: 'Orange' }

/** The colours of the photochromic lens (a picture each), included in the lens price. Night-vision variants are left out. */
function photochromicColours(virtual: Record<string, unknown>[]): ShopOption[] {
  const g = virtual.find((x) => text(x.title).toLowerCase() === 'photochromic lens')
  return arr(g?.values).map(obj).map((v) => ({ key: text(v.key).replace(/^photochromic\s+/i, ''), image: southoodImage(v.value) }))
    .filter((v) => COLOUR_FR[v.key.toLowerCase()])
    .map((v) => ({ label: COLOUR_FR[v.key.toLowerCase()], label_en: v.key, image: v.image, price_usd: 0 }))
}

const CASE_FR: Record<string, string> = { blue: 'Bleu', brown: 'Marron', red: 'Rouge', 'rose red': 'Rose', silver: 'Argent', black: 'Noir' }
