import { describe, expect, it } from 'vitest'
import { DEFAULT_RATES, estimateCost, guessCategory, suggestQuote, toUsd } from './cost-estimate'

describe('estimateCost', () => {
  it('matches the formula used in the admin settings preview (50 × $4.50, 0.25 kg)', () => {
    const e = estimateCost({ priceUsd: 4.5, quantity: 50, weightKg: 0.25 }, { ...DEFAULT_RATES, usdToHtg: 132 })
    expect(e.productUsd).toBeCloseTo(225)
    expect(e.freightUsd).toBeCloseTo(137.5)
    expect(e.dutyUsd).toBeCloseTo(72.5)
    expect(e.serviceUsd).toBeCloseTo(65.25)
    expect(e.totalUsd).toBeCloseTo(500.25)
    expect(e.totalHtg).toBeCloseTo(500.25 * 132)
    expect(e.perUnitHtg).toBeCloseTo((500.25 * 132) / 50)
  })
  it('treats a zero or negative quantity as one unit', () => {
    expect(estimateCost({ priceUsd: 10, quantity: 0, weightKg: 0 }, DEFAULT_RATES).productUsd).toBe(10)
  })
})

describe('toUsd', () => {
  it('converts CNY and EUR, keeps USD, refuses unknown currencies', () => {
    expect(toUsd(10, 'USD', DEFAULT_RATES)).toBe(10)
    expect(toUsd(10, null, DEFAULT_RATES)).toBe(10)
    expect(toUsd(100, 'CNY', DEFAULT_RATES)).toBeCloseTo(14)
    expect(toUsd(10, 'eur', DEFAULT_RATES)).toBeCloseTo(10.8)
    expect(toUsd(10, 'JPY', DEFAULT_RATES)).toBeNull()
  })
})

describe('guessCategory', () => {
  it('recognises common products', () => {
    expect(guessCategory('Custom sport socks')).toBe('clothing')
    expect(guessCategory('Fast USB charger 65W')).toBe('electronics')
    expect(guessCategory('Matte lipstick set')).toBe('cosmetics')
    expect(guessCategory('Kitchen storage box')).toBe('home')
  })
  it('returns null when unsure', () => expect(guessCategory('Mystery item 123')).toBeNull())
})

describe('suggestQuote', () => {
  it('is consistent with the customer estimate (same total, in whole gourdes)', () => {
    const rates = { ...DEFAULT_RATES, usdToHtg: 140 }
    const s = suggestQuote({ unitPriceUsd: 4.5, quantity: 50, totalWeightKg: 25 }, rates)
    const e = estimateCost({ priceUsd: 4.5, quantity: 50, weightKg: 0.5 }, rates)
    expect(s.unitPriceHtg).toBe(630)
    expect(Math.abs(s.totalHtg - e.totalHtg)).toBeLessThanOrEqual(3)
  })
})
