import { describe, expect, it } from 'vitest'
import { installmentAmounts } from './installments'

describe('installmentAmounts', () => {
  it('splits 50/50 and keeps the exact total', () => {
    expect(installmentAmounts(100000, 2)).toEqual([50000, 50000])
    expect(installmentAmounts(33333, 2)).toEqual([16667, 16666])
  })
  it('splits 40/30/30 and keeps the exact total', () => {
    expect(installmentAmounts(100000, 3)).toEqual([40000, 30000, 30000])
    const a = installmentAmounts(77777, 3)
    expect(a.reduce((s, n) => s + n, 0)).toBe(77777)
    expect(a[0]).toBeGreaterThanOrEqual(a[1])
  })
})
