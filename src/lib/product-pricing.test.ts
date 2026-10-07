import { describe, expect, it } from 'vitest'
import { bestOffer, effectiveUnitPrice, lineTotal, normalizeTiers, offerLabel, priceRange, tierRows, unitPriceFor, variantUnitPrice } from './product-pricing'

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

describe('supplier offers are packs', () => {
  const mutant = { price_htg: 14490, moq: 1, price_tiers: [{ min_qty: 2, price_htg: 9660, src: 'sync', kind: 'multi_buy', buy: 2 }] }
  const base = { price_htg: 14490 }
  const other = { price_htg: 14975 }

  it('prices full packs at the offer and the other units at the regular price', () => {
    expect(lineTotal(mutant, 1, base)).toBe(14490)
    expect(lineTotal(mutant, 2, base)).toBe(19320)
    expect(lineTotal(mutant, 3, base)).toBe(33810)
    expect(lineTotal(mutant, 4, base)).toBe(38640)
    expect(lineTotal(mutant, 5, base)).toBe(53130)
  })
  it('does not apply the offer to a variant with its own price', () => {
    expect(lineTotal(mutant, 3, other)).toBe(44925)
    expect(bestOffer(mutant, other)).toBeNull()
    expect(bestOffer(mutant, base)?.min_qty).toBe(2)
  })
  it('gives an average unit price that multiplies back to the total', () => {
    expect(effectiveUnitPrice(mutant, 3, base) * 3).toBeCloseTo(33810, 6)
    expect(effectiveUnitPrice(mutant, 0, base)).toBe(0)
  })
  it('ignores the offers for the unit price, the tier rows and the price range', () => {
    expect(unitPriceFor(mutant, 4)).toBe(14490)
    expect(tierRows(mutant)).toEqual([{ from: 1, to: null, price: 14490 }])
    expect(priceRange(mutant)).toEqual({ min: 14490, max: 14490 })
  })
  it('combines several pack sizes, the biggest first', () => {
    const p = { price_htg: 100, moq: 1, price_tiers: [{ min_qty: 2, price_htg: 80, src: 'sync' }, { min_qty: 3, price_htg: 70, src: 'sync' }] }
    expect(lineTotal(p, 5)).toBe(3 * 70 + 2 * 80)
    expect(lineTotal(p, 7)).toBe(2 * 3 * 70 + 100)
  })
  it('never costs more than the flat price and keeps hand-made tiers for the units outside the packs', () => {
    const p = { price_htg: 100, moq: 1, price_tiers: [{ min_qty: 10, price_htg: 60 }, { min_qty: 2, price_htg: 90, src: 'sync' }] }
    expect(lineTotal(p, 10)).toBe(600)
    expect(lineTotal(p, 3)).toBe(2 * 90 + 100)
  })
  it('works for resellers (the prices already carry their discount)', () => {
    const reseller = { price_htg: 11592, moq: 1, price_tiers: [{ min_qty: 2, price_htg: 7728, src: 'sync' }], reseller_price: true, reseller_discount_pct: 20 }
    expect(lineTotal(reseller, 2, { price_htg: 14490 })).toBe(15456)
    expect(lineTotal(reseller, 2, { price_htg: 14975 })).toBe(23960)
  })
  it('names the offers', () => {
    expect(offerLabel({ min_qty: 2, price_htg: 100, src: 'sync', kind: 'multi_buy', buy: 2 })).toContain('2')
    expect(offerLabel({ min_qty: 2, price_htg: 100, src: 'sync', kind: 'free_item', buy: 1, free: 1, off: 100 })).toMatch(/1.*1/)
    expect(offerLabel({ min_qty: 2, price_htg: 75, src: 'sync', kind: 'free_item', buy: 1, free: 1, off: 50 })).toContain('50')
  })
  it('keeps the offer details when the tiers are cleaned', () => {
    expect(normalizeTiers([{ min_qty: 2, price_htg: 5, src: 'sync', kind: 'free_item', buy: 1, free: 1, off: 50 }, { min_qty: 3, price_htg: 4, kind: 'multi_buy' }]))
      .toEqual([{ min_qty: 2, price_htg: 5, src: 'sync', kind: 'free_item', buy: 1, free: 1, off: 50 }, { min_qty: 3, price_htg: 4 }])
  })
})
