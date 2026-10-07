import { describe, expect, it } from 'vitest'
import { cartDiscountedPrice, impliedUsd, needsReview, promoTiers } from './promos'

describe('promoTiers', () => {
  it('reads "2 for $40" as 2 units at $20', () => {
    expect(promoTiers(25, [{ kind: 'multi_buy', qty: 2, total_price: 40 }])).toMatchObject([{ min_qty: 2, unit_usd: 20 }])
  })
  it('reads "buy 1 get 1 free" as 2 units at half price, "buy 2 get 1 free" as 3 units at two thirds', () => {
    expect(promoTiers(30, [{ kind: 'free_item', qty: 1, free_qty: 1 }])).toMatchObject([{ min_qty: 2, unit_usd: 15 }])
    expect(promoTiers(30, [{ kind: 'free_item', qty: 2, free_qty: 1 }])).toMatchObject([{ min_qty: 3, unit_usd: 20 }])
  })
  it('combines several offers, the unit price going down with the quantity', () => {
    expect(promoTiers(35, [{ kind: 'multi_buy', qty: 3, total_price: 90 }, { kind: 'multi_buy', qty: 2, total_price: 60 }])).toMatchObject([{ min_qty: 2, unit_usd: 30 }])
    expect(promoTiers(35, [{ kind: 'multi_buy', qty: 3, total_price: 75 }, { kind: 'multi_buy', qty: 2, total_price: 60 }])).toMatchObject([{ min_qty: 2, unit_usd: 30 }, { min_qty: 3, unit_usd: 25 }])
  })
  it('keeps the cheapest offer of a quantity and drops offers that do not lower the price', () => {
    expect(promoTiers(20, [{ kind: 'multi_buy', qty: 2, total_price: 36 }, { kind: 'multi_buy', qty: 2, total_price: 34 }])).toMatchObject([{ min_qty: 2, unit_usd: 17 }])
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

describe('offer details', () => {
  it('keeps the kind and the numbers so the shop can name the offer', () => {
    expect(promoTiers(30, [{ kind: 'multi_buy', qty: 2, total_price: 48 }])).toEqual([{ min_qty: 2, unit_usd: 24, kind: 'multi_buy', buy: 2 }])
    expect(promoTiers(30, [{ kind: 'free_item', qty: 1, free_qty: 1 }])).toEqual([{ min_qty: 2, unit_usd: 15, kind: 'free_item', buy: 1, free: 1, off: 100 }])
  })
})

describe('impliedUsd', () => {
  it('goes back from a shop price to the supplier price', () => {
    expect(impliedUsd(4025, 140, 15)).toBe(25)
    expect(impliedUsd(13685, 140, 15)).toBe(85)
    expect(impliedUsd(0, 140, 15)).toBe(0)
  })
})

describe('the offers of Muscle & Strength', () => {
  it('reads "Buy 1 Get 1 50% Off" as 2 units at 75% of the price', () => {
    expect(promoTiers(40, [{ kind: 'free_item', qty: 1, free_qty: 1, discount_percent: 50 }])).toMatchObject([{ min_qty: 2, unit_usd: 30 }])
  })
  it('reads "Buy X Get Y Free" with any numbers', () => {
    expect(promoTiers(20, [{ kind: 'free_item', qty: 3, free_qty: 1 }])).toMatchObject([{ min_qty: 4, unit_usd: 15 }])
  })
  it('takes an in-cart discount off the unit price, never more than 50%', () => {
    expect(cartDiscountedPrice(40, [{ kind: 'cart_discount', percent: 15 }])).toBe(34)
    expect(cartDiscountedPrice(40, [{ kind: 'cart_discount', percent: 15 }, { kind: 'cart_discount', percent: 20 }])).toBe(32)
    expect(cartDiscountedPrice(40, [{ kind: 'cart_discount', percent: 80 }])).toBe(40)
    expect(cartDiscountedPrice(40, undefined)).toBe(40)
  })
})
