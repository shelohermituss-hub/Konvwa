import { describe, expect, it } from 'vitest'
import { insuranceFeeHtg } from './insurance'

describe('insuranceFeeHtg', () => {
  it('applies rate then exchange, rounded up', () => {
    expect(insuranceFeeHtg(200, 3, 140)).toBe(840)
    expect(insuranceFeeHtg(101, 3, 140.5)).toBe(Math.ceil(101 * 0.03 * 140.5))
  })
  it('is zero for invalid values', () => {
    expect(insuranceFeeHtg(0, 3, 140)).toBe(0)
    expect(insuranceFeeHtg(NaN, 3, 140)).toBe(0)
  })
})
