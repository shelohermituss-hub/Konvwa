import { describe, expect, it } from 'vitest'
import { buildShelves, inShelf, parseShelf, shelfKey } from './shelves'
import type { CatalogProduct } from './catalog'

let n = 0
const product = (over: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: String(++n), name: 'p' + n, description: null, price_htg: 100, price_tiers: [], moq: 1, unit: 'pc', supplier_name: 'Amazon', supplier_verified: true,
  supplier_years: null, supplier_country: 'US', category: 'Électronique', delivery_days_min: null, delivery_days_max: null, processing_days: null, images: [],
  specifications: null, stock_available: true, featured: false, sold_count: 0, rating: null, review_count: 0, repurchase_rate: null, customization_options: [],
  tags: [], certifications: [], name_en: null, description_en: null, tags_en: [], customization_options_en: [], certifications_en: [], ...over,
})
const many = (k: number, over: Partial<CatalogProduct> = {}) => Array.from({ length: k }, () => product(over))
const offerTier = [{ min_qty: 2, price_htg: 90, kind: 'multi_buy', src: 'sync' }]

describe('home shelves', () => {
  it('puts electronics first among the categories and drops small shelves', () => {
    const shelves = buildShelves([...many(5, { category: 'Beauté & Santé' }), ...many(4, { category: 'Électronique' }), ...many(3, { category: 'Jouets & Jeux' })])
    expect(shelves.map((s) => shelfKey(s.ref))).toEqual(['category:Électronique', 'category:Beauté & Santé'])
  })
  it('puts the discounted products first, but not the reseller-priced ones', () => {
    const shelves = buildShelves([...many(4, { discount_pct: 20, category: null }), ...many(4, { discount_pct: 20, reseller_price: true, category: null }), ...many(4, { price_tiers: offerTier, category: null })])
    expect(shelves.map((s) => shelfKey(s.ref))).toEqual(['sale', 'offers'])
    expect(shelves[0].items).toHaveLength(4)
  })
  it('builds the offers and favourites shelves from the products that qualify', () => {
    const shelves = buildShelves([...many(4, { price_tiers: offerTier, category: null }), ...many(4, { featured: true, category: null }), ...many(6, { category: null })])
    expect(shelves.map((s) => shelfKey(s.ref))).toEqual(['offers', 'featured'])
  })
  it('never shows an out-of-stock product in offers or favourites', () => {
    expect(inShelf(product({ featured: true, stock_available: false }), { kind: 'featured' })).toBe(false)
  })
  it('reads a shelf back from its link key', () => {
    for (const key of ['sale', 'offers', 'featured', 'category:Électronique', 'brand:Muscle & Strength']) expect(shelfKey(parseShelf(key)!)).toBe(key)
    expect(parseShelf('nope')).toBeNull()
    expect(parseShelf(null)).toBeNull()
  })
  it('caps a shelf at 12 products', () => {
    const [shelf] = buildShelves(many(30, { featured: true, category: null }))
    expect(shelf.items).toHaveLength(12)
  })
  it('adds a brand shelf for a known supplier logo', () => {
    const shelves = buildShelves(many(5, { supplier_name: 'Muscle & Strength', category: null }))
    expect(shelves.map((s) => shelfKey(s.ref))).toEqual(['brand:Muscle & Strength'])
  })
})
