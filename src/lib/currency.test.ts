import { describe, expect, it } from 'vitest'
import { money, moneyAmount, toDisplay } from './currency'

describe('currency display', () => {
  it('keeps HTG as is', () => {
    expect(toDisplay(12500, 'HTG', 140)).toBe(12500)
    expect(money(12500, 'HTG', 140, 'en-US')).toBe('12,500 HTG')
  })
  it('converts to USD with the rate, rounded to cents', () => {
    expect(toDisplay(1400, 'USD', 140)).toBe(10)
    expect(toDisplay(100, 'USD', 140)).toBe(0.71)
    expect(money(12500, 'USD', 140, 'en-US')).toBe('89.29 USD')
    expect(moneyAmount(1400, 'USD', 140, 'en-US')).toBe('10.00')
  })
  it('never prints NaN', () => {
    expect(money(Number.NaN, 'HTG', 140, 'en-US')).toBe('0 HTG')
    expect(money(Number.NaN, 'USD', 140, 'en-US')).toBe('0.00 USD')
  })
})
