// Variants (size, colour…) read from a product page, turned into clean, bounded rows. Pure: unit-tested with vitest.
import { cleanText } from './normalize.ts'

export interface RawVariant { name?: unknown; color?: unknown; size?: unknown; price?: unknown; currency?: unknown; image?: unknown; in_stock?: unknown }
export interface RawOption { name?: unknown; image?: unknown; price?: unknown; currency?: unknown; in_stock?: unknown }
export interface RawVariantInput { variants?: unknown; colors?: unknown; sizes?: unknown }

export interface VariantRow {
  group_name: string | null
  label: string
  /** Regular price (before any promotion) in USD; the product's base price when the page gave none. */
  price_usd: number | null
  image: string | null
  in_stock: boolean
}

export interface VariantDeps {
  /** A valid picture URL of the platform, or null. */
  image: (raw: unknown) => string | null
  /** Price in USD from a price and its currency, or null. */
  price: (price: unknown, currency: unknown) => number | null
  max?: number
}

const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [])
const inStock = (v: unknown) => v !== false && !/^(false|no|out)/i.test(String(v ?? ''))

/**
 * Explicit variants win. Otherwise colours x sizes are combined (the colour carries the picture, the size may carry the price).
 * Duplicated labels are dropped, the result is capped (`max`, 100 by default) and flagged when it had to be cut.
 */
export function normalizeVariants(input: RawVariantInput, deps: VariantDeps): { rows: VariantRow[]; truncated: boolean } {
  const max = deps.max ?? 100
  const rows: VariantRow[] = []
  const seen = new Set<string>()
  let truncated = false
  const push = (row: VariantRow) => {
    const key = row.label.toLowerCase()
    if (!row.label || seen.has(key)) return
    if (rows.length >= max) { truncated = true; return }
    seen.add(key); rows.push(row)
  }
  const explicit = list(input.variants) as RawVariant[]
  for (const v of explicit) {
    const color = cleanText(v.color, 60); const size = cleanText(v.size, 60)
    const label = cleanText(v.name, 120) || [color, size].filter(Boolean).join(' / ')
    const group = color && size ? 'Couleur / Taille' : color ? 'Couleur' : size ? 'Taille' : null
    push({ group_name: group, label, price_usd: deps.price(v.price, v.currency), image: deps.image(v.image), in_stock: inStock(v.in_stock) })
  }
  if (rows.length === 0) {
    const colors = list(input.colors) as RawOption[]; const sizes = list(input.sizes) as RawOption[]
    if (colors.length > 0 && sizes.length > 0) {
      for (const c of colors) for (const s of sizes) {
        const cn = cleanText(c.name, 60); const sn = cleanText(s.name, 60)
        if (!cn || !sn) continue
        push({
          group_name: 'Couleur / Taille', label: `${cn} / ${sn}`,
          price_usd: deps.price(s.price, s.currency) ?? deps.price(c.price, c.currency), image: deps.image(c.image),
          in_stock: inStock(c.in_stock) && inStock(s.in_stock),
        })
      }
    } else {
      const single = colors.length > 0 ? colors : sizes
      const group = colors.length > 0 ? 'Couleur' : 'Taille'
      for (const o of single) push({ group_name: group, label: cleanText(o.name, 120), price_usd: deps.price(o.price, o.currency), image: deps.image(o.image), in_stock: inStock(o.in_stock) })
    }
  }
  return { rows, truncated }
}
