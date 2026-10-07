import { describe, expect, it } from 'vitest'
import { expandVariants, productPath, resellerPriced, sizeOf, type CatalogProduct } from './catalog'

describe('resellerPriced', () => {
  const p = { price_htg: 155, price_tiers: [{ min_qty: 500, price_htg: 142 }], reseller_discount_pct: 20 }
  it('discounts the base price and every tier for resellers', () => {
    const r = resellerPriced(p, true)
    expect(r.price_htg).toBe(124)
    expect(r.price_tiers).toEqual([{ min_qty: 500, price_htg: 113.6 }])
    expect(r.reseller_price).toBe(true)
  })
  it('leaves other customers and products without discount untouched', () => {
    expect(resellerPriced(p, false)).toBe(p)
    const plain = { price_htg: 10, reseller_discount_pct: 0 }
    expect(resellerPriced(plain, true)).toBe(plain)
  })
})

describe('sizeOf / expandVariants by size', () => {
  const w = (id: string, label: string, order: number) => ({ id, label, label_en: null, group_name: 'Couleur / Taille', price_htg: 100, image: `${id}.jpg`, stock_available: true, sort_order: order })
  it('reads the size of a label', () => {
    expect(sizeOf('Chocolat / 12lbs')).toBe('12lb')
    expect(sizeOf('300g Sans saveur')).toBe('300g')
    expect(sizeOf('Triple Chocolat - 5 lbs')).toBe('5lb')
    expect(sizeOf('Vanille')).toBe('')
  })
  it('makes one card per size, not per flavour', () => {
    const p = { id: 'p1', product_variants: [w('a', 'Banane / 6lbs', 1), w('b', 'Chocolat / 6lbs', 2), w('c', 'Banane / 12lbs', 3), w('d', 'Chocolat / 12lbs', 4)] } as unknown as CatalogProduct
    expect(expandVariants([p]).map((c) => c.feed_key.split(':')[1])).toEqual(['a', 'c'])
  })
})

describe('expandVariants', () => {
  const v = (id: string, image: string | null, order: number, group: string | null = 'Couleur') => ({ id, label: id, label_en: null, group_name: group, price_htg: 100, image, stock_available: true, sort_order: order })
  const base = (variants: ReturnType<typeof v>[]) => ({ id: 'p1', product_variants: variants }) as unknown as CatalogProduct

  it('makes one card per variant, all opening the same product', () => {
    const cards = expandVariants([base([v('a', 'a.jpg', 2), v('b', 'b.jpg', 1), v('c', 'c.jpg', 3)])])
    expect(cards.map((c) => c.feed_key)).toEqual(['p1:b', 'p1:a', 'p1:c'])
    expect(cards.map((c) => productPath(c))).toEqual(['/products/p1?variant=b', '/products/p1?variant=a', '/products/p1?variant=c'])
  })
  it('keeps a product without variants as one plain card', () => {
    const cards = expandVariants([base([])])
    expect(cards).toHaveLength(1)
    expect(cards[0].feed_variant).toBeUndefined()
    expect(productPath(cards[0])).toBe('/products/p1')
  })
  it('leaves variants without a picture out of the feed', () => {
    expect(expandVariants([base([v('a', 'a.jpg', 1), v('b', null, 2), v('c', 'c.jpg', 3)])]).map((c) => c.feed_key)).toEqual(['p1:a', 'p1:c'])
    const plain = expandVariants([base([v('a', null, 1), v('b', null, 2)])])
    expect(plain).toHaveLength(1)
    expect(plain[0].feed_variant).toBeUndefined()
  })
  it('only colours get a card, not sizes or other options', () => {
    const cards = expandVariants([base([v('red', 'r.jpg', 1), v('xl', 'x.jpg', 2, 'Taille'), v('pro', 'p.jpg', 3, null), v('blue / M', 'b.jpg', 4, 'Couleur / Taille')])])
    expect(cards.map((c) => c.feed_key)).toEqual(['p1:red', 'p1:blue / M'])
    expect(expandVariants([base([v('s', 's.jpg', 1, 'Taille'), v('m', 'm.jpg', 2, 'Taille')])])).toHaveLength(1)
    expect(expandVariants([base([v('red', 'r.jpg', 1, 'Color')])])[0].feed_variant?.id).toBe('red')
  })
  it('merges variants that share a picture and caps the cards of one product', () => {
    expect(expandVariants([base([v('s', 'red.jpg', 1), v('m', 'red.jpg', 2), v('l', 'blue.jpg', 3)])])).toHaveLength(2)
    expect(expandVariants([base(Array.from({ length: 30 }, (_, i) => v(`v${i}`, `${i}.jpg`, i)))])).toHaveLength(3)
  })
})
