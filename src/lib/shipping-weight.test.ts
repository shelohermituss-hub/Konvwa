import { describe, expect, it } from 'vitest'
import { billedWeightKg } from './shipping-weight'

describe('billedWeightKg', () => {
  it('takes the greater of the real and the volumetric weight (inches / 132)', () => {
    // 0.1 m³ = 6102.4 in³ ÷ 132 = 46.2 lb = 20.97 kg
    expect(billedWeightKg(132, 'in', 10, 0.1)).toBeCloseTo(20.97, 1)
    expect(billedWeightKg(132, 'in', 30, 0.1)).toBe(30)
  })
  it('converts centimetres (÷ 2000, in pounds)', () => {
    expect(billedWeightKg(2000, 'cm', 1, 0.02)).toBeCloseTo(0.02 * 1_000_000 / 2000 / 2.2046226, 3)
  })
  it('real weight only, or the platform default', () => {
    expect(billedWeightKg(null, 'none', 2, 5)).toBe(2)
    expect(billedWeightKg(null, null, 1, 0.012)).toBeCloseTo(2, 3)
  })
})
