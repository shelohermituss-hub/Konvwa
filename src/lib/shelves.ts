import { bestOffer, discountPct } from '@/lib/product-pricing'
import { supplierLogo } from '@/lib/supplier-badges'
import type { CatalogProduct } from '@/lib/catalog'

/** A themed row of the home feed ("rayon"): what it is, so the page can title it, filter by it and list it. */
export type ShelfRef =
  | { kind: 'sale' }
  | { kind: 'offers' }
  | { kind: 'featured' }
  | { kind: 'category'; value: string }
  | { kind: 'brand'; value: string }

export interface Shelf { ref: ShelfRef; items: CatalogProduct[] }

/** A shelf needs at least this many products to be worth showing, and shows at most MAX_ITEMS. */
export const MIN_ITEMS = 4
export const MAX_ITEMS = 12
const MAX_CATEGORY_SHELVES = 4
const MAX_BRAND_SHELVES = 2

export const shelfKey = (r: ShelfRef): string => (r.kind === 'category' || r.kind === 'brand' ? `${r.kind}:${r.value}` : r.kind)

/** Does this product belong to the shelf? (also used when "See all" turns a shelf into the filter of the whole feed) */
export function inShelf(p: CatalogProduct, r: ShelfRef): boolean {
  switch (r.kind) {
    case 'sale': return p.stock_available && discountPct(p) > 0
    case 'offers': return p.stock_available && bestOffer(p) !== null
    case 'featured': return p.stock_available && p.featured
    case 'category': return p.category === r.value
    case 'brand': return p.supplier_name === r.value
  }
}

/**
 * The shelves of the home feed, in the order shown: discounts, offers of the moment, favourites, the biggest categories (electronics first),
 * then the brands whose logo we know (Amazon, Muscle & Strength…). Small shelves are left out; a product may appear in several.
 */
export function buildShelves(products: CatalogProduct[]): Shelf[] {
  const make = (ref: ShelfRef): Shelf => ({ ref, items: products.filter((p) => inShelf(p, ref)) })
  const shelves: Shelf[] = [make({ kind: 'sale' }), make({ kind: 'offers' }), make({ kind: 'featured' })]

  const count = new Map<string, number>()
  for (const p of products) if (p.category) count.set(p.category, (count.get(p.category) ?? 0) + 1)
  const categories = [...count.entries()]
    .sort((a, b) => (a[0] === 'Électronique' ? -1 : b[0] === 'Électronique' ? 1 : b[1] - a[1]))
    .slice(0, MAX_CATEGORY_SHELVES)
  for (const [value] of categories) shelves.push(make({ kind: 'category', value }))

  const brands = new Map<string, number>()
  for (const p of products) if (p.supplier_name && supplierLogo(p.supplier_name) && p.supplier_name !== 'Amazon') brands.set(p.supplier_name, (brands.get(p.supplier_name) ?? 0) + 1)
  const brandShelves = [...brands.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_BRAND_SHELVES)
  for (const [value] of brandShelves) shelves.push(make({ kind: 'brand', value }))

  return shelves.filter((s) => s.items.length >= MIN_ITEMS).map((s) => ({ ...s, items: s.items.slice(0, MAX_ITEMS) }))
}

/** The shelf named by a link ("/products?shelf=category:Électronique"), or null when the text is not a shelf. */
export function parseShelf(key: string | null): ShelfRef | null {
  if (!key) return null
  if (key === 'sale' || key === 'offers' || key === 'featured') return { kind: key }
  const m = /^(category|brand):(.{1,80})$/.exec(key)
  return m ? { kind: m[1] as 'category' | 'brand', value: m[2] } : null
}
