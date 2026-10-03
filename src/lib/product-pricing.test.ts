import { describe, expect, it } from 'vitest'
import { normalizeTiers, priceRange, tierRows, unitPriceFor } from './product-pricing'

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
