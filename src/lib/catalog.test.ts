import { describe, expect, it } from 'vitest'
import { resellerPriced } from './catalog'

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
