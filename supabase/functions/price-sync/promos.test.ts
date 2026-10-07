import { describe, expect, it } from 'vitest'
import { impliedUsd, needsReview, promoTiers } from './promos'

describe('promoTiers', () => {
  it('reads "2 for $40" as 2 units at $20', () => {
    expect(promoTiers(25, [{ kind: 'multi_buy', qty: 2, total_price: 40 }])).toEqual([{ min_qty: 2, unit_usd: 20 }])
  })
  it('reads "buy 1 get 1 free" as 2 units at half price, "buy 2 get 1 free" as 3 units at two thirds', () => {
    expect(promoTiers(30, [{ kind: 'free_item', qty: 1, free_qty: 1 }])).toEqual([{ min_qty: 2, unit_usd: 15 }])
    expect(promoTiers(30, [{ kind: 'free_item', qty: 2, free_qty: 1 }])).toEqual([{ min_qty: 3, unit_usd: 20 }])
  })
  it('combines several offers, the unit price going down with the quantity', () => {
    expect(promoTiers(35, [{ kind: 'multi_buy', qty: 3, total_price: 90 }, { kind: 'multi_buy', qty: 2, total_price: 60 }])).toEqual([{ min_qty: 2, unit_usd: 30 }])
    expect(promoTiers(35, [{ kind: 'multi_buy', qty: 3, total_price: 75 }, { kind: 'multi_buy', qty: 2, total_price: 60 }])).toEqual([{ min_qty: 2, unit_usd: 30 }, { min_qty: 3, unit_usd: 25 }])
  })
  it('keeps the cheapest offer of a quantity and drops offers that do not lower the price', () => {
    expect(promoTiers(20, [{ kind: 'multi_buy', qty: 2, total_price: 36 }, { kind: 'multi_buy', qty: 2, total_price: 34 }])).toEqual([{ min_qty: 2, unit_usd: 17 }])
    expect(promoTiers(20, [{ kind: 'multi_buy', qty: 2, total_price: 40 }, { kind: 'multi_buy', qty: 3, total_price: 70 }])).toEqual([])
  })
  it('ignores other kinds, absurd values and garbage', () => {
    expect(promoTiers(25, [{ kind: 'percent_off', qty: 2, total_price: 10 }, { kind: 'multi_buy', qty: 2, total_price: 2 }, null, 'x', { kind: 'free_item', qty: 0, free_qty: 1 }])).toEqual([])
    expect(promoTiers(0, [{ kind: 'multi_buy', qty: 2, total_price: 10 }])).toEqual([])
    expect(promoTiers(25, undefined)).toEqual([])
  })
})

describe('needsReview', () => {
  it('lets small changes through and holds big ones', () => {
    expect(needsReview(100, 110)).toBe(false)
    expect(needsReview(100, 85)).toBe(false)
    expect(needsReview(100, 120)).toBe(true)
    expect(needsReview(100, 70)).toBe(true)
  })
  it('has nothing to compare on the first check', () => {
    expect(needsReview(null, 80)).toBe(false)
  })
})

describe('impliedUsd', () => {
  it('goes back from a shop price to the supplier price', () => {
    expect(impliedUsd(4025, 140, 15)).toBe(25)
    expect(impliedUsd(13685, 140, 15)).toBe(85)
    expect(impliedUsd(0, 140, 15)).toBe(0)
  })
})
