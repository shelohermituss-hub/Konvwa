import { describe, expect, it } from 'vitest'
import { priceHtgFromUsd } from './import-pricing'

describe('priceHtgFromUsd', () => {
  it('applies the rate then the margin and rounds up to 5 HTG', () => {
    expect(priceHtgFromUsd(19.99, 140, 15)).toBe(3220)
    expect(priceHtgFromUsd(10, 140, 0)).toBe(1400)
    expect(priceHtgFromUsd(1, 133, 10)).toBe(150)
  })
  it('returns 0 for unusable input', () => {
    expect(priceHtgFromUsd(0, 140, 15)).toBe(0)
    expect(priceHtgFromUsd(10, 0, 15)).toBe(0)
    expect(priceHtgFromUsd(-5, 140, 15)).toBe(0)
  })
  it('never lowers the price with a negative margin', () => {
    expect(priceHtgFromUsd(10, 140, -50)).toBe(1400)
  })
})
