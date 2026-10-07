import { describe, expect, it } from 'vitest'
import { normalizeTiers, priceRange, tierRows, unitPriceFor, variantPriceRange, variantUnitPrice } from './product-pricing'

const product = { price_htg: 155, moq: 100, price_tiers: [{ min_qty: 1000, price_htg: 130 }, { min_qty: 500, price_htg: 142 }] }

describe('normalizeTiers', () => {
  it('sorts tiers and drops malformed ones', () => {
    expect(normalizeTiers([{ min_qty: 1000, price_htg: 130 }, { min_qty: 'x', price_htg: 1 }, null, { min_qty: 500, price_htg: 0 }, { min_qty: 500, price_htg: 142 }]))
      .toEqual([{ min_qty: 500, price_htg: 142 }, { min_qty: 1000, price_htg: 130 }])
  })
  it('accepts anything that is not an array', () => {
    expect(normalizeTiers(undefined)).toEqual([])
    expect(normalizeTiers({})).toEqual([])
  })
})

describe('unitPriceFor', () => {
  it('uses the base price below the first tier', () => expect(unitPriceFor(product, 100)).toBe(155))
  it('switches exactly at the tier quantity', () => {
    expect(unitPriceFor(product, 499)).toBe(155)
    expect(unitPriceFor(product, 500)).toBe(142)
    expect(unitPriceFor(product, 999)).toBe(142)
    expect(unitPriceFor(product, 1000)).toBe(130)
  })
})

describe('priceRange and tierRows', () => {
  it('spans the cheapest to the dearest unit price', () => expect(priceRange(product)).toEqual({ min: 130, max: 155 }))
  it('builds contiguous quantity bands starting at the MOQ', () => {
    expect(tierRows(product)).toEqual([
      { from: 100, to: 499, price: 155 },
      { from: 500, to: 999, price: 142 },
      { from: 1000, to: null, price: 130 },
    ])
  })
})

describe('variantUnitPrice', () => {
  const p = { price_htg: 1000, moq: 1, price_tiers: [{ min_qty: 10, price_htg: 800 }] }
  it('uses the variant price below the first tier', () => expect(variantUnitPrice(p, { price_htg: 1500 }, 2)).toBe(1500))
  it('applies the same % as the quantity tier to the variant price', () => expect(variantUnitPrice(p, { price_htg: 2000 }, 10)).toBe(1600))
  it('applies the reseller discount on top (product already reseller-priced)', () => {
    const rp = { price_htg: 900, moq: 1, price_tiers: [{ min_qty: 10, price_htg: 720 }], reseller_price: true, reseller_discount_pct: 10 }
    expect(variantUnitPrice(rp, { price_htg: 2000 }, 10)).toBe(1440)
  })
})

describe('variantPriceRange', () => {
  it('spans the quantity tiers with the same % discount as the product', () => {
    const product = { price_htg: 100, moq: 10, price_tiers: [{ min_qty: 50, price_htg: 80 }, { min_qty: 100, price_htg: 50 }] }
    expect(variantPriceRange(product, { price_htg: 200 })).toEqual({ min: 100, max: 200 })
    expect(variantPriceRange({ price_htg: 100, moq: 1, price_tiers: [] }, { price_htg: 120 })).toEqual({ min: 120, max: 120 })
  })
})

describe('a supplier offer belongs to the base option', () => {
  const product = { price_htg: 14490, moq: 1, price_tiers: [{ min_qty: 2, price_htg: 9660, src: 'sync' }] }
  it('discounts the variants priced like the base, not the others', () => {
    expect(variantUnitPrice(product, { price_htg: 14490 }, 1)).toBe(14490)
    expect(variantUnitPrice(product, { price_htg: 14490 }, 2)).toBe(9660)
    expect(variantUnitPrice(product, { price_htg: 14975 }, 2)).toBe(14975)
  })
  it('keeps the same % rule for manual tiers', () => {
    const manual = { price_htg: 100, moq: 1, price_tiers: [{ min_qty: 10, price_htg: 80 }] }
    expect(variantUnitPrice(manual, { price_htg: 150 }, 10)).toBe(120)
  })
  it('keeps the tier marker when the tiers are cleaned', () => {
    expect(normalizeTiers([{ min_qty: 2, price_htg: 5, src: 'sync' }, { min_qty: 3, price_htg: 4, src: 'x' }])).toEqual([{ min_qty: 2, price_htg: 5, src: 'sync' }, { min_qty: 3, price_htg: 4 }])
  })
  it('works for resellers (the base price already carries their discount)', () => {
    const reseller = { ...product, price_htg: 11592, price_tiers: [{ min_qty: 2, price_htg: 7728, src: 'sync' }], reseller_price: true, reseller_discount_pct: 20 }
    expect(variantUnitPrice(reseller, { price_htg: 14490 }, 2)).toBe(7728)
    expect(variantUnitPrice(reseller, { price_htg: 14975 }, 2)).toBe(11980)
  })
})
