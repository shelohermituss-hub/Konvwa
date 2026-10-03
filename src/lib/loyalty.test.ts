import { describe, expect, it } from 'vitest'
import { discountedFee, tierProgress } from './loyalty'

describe('loyalty', () => {
  const base = { silver_at: 3, gold_at: 10 }
  it('computes progress inside each tier', () => {
    expect(tierProgress({ ...base, tier: 'bronze', orders: 0 })).toBe(0)
    expect(tierProgress({ ...base, tier: 'bronze', orders: 2 })).toBe(67)
    expect(tierProgress({ ...base, tier: 'silver', orders: 3 })).toBe(0)
    expect(tierProgress({ ...base, tier: 'silver', orders: 7 })).toBe(57)
    expect(tierProgress({ ...base, tier: 'gold', orders: 25 })).toBe(100)
  })
  it('applies the discount to the fee', () => {
    expect(discountedFee(5000, 10)).toBe(4500)
    expect(discountedFee(5000, 0)).toBe(5000)
    expect(discountedFee(5000, 150)).toBe(0)
  })
})
