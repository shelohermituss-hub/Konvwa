import { describe, expect, it } from 'vitest'
import { feedOrder, seededUnit, spreadSiblings } from './feed-order'
import type { FeedItem } from './catalog'

const card = (id: string, variant: string | null = null, featured = false) =>
  ({ id, featured, feed_key: variant ? `${id}:${variant}` : id }) as unknown as FeedItem

describe('seededUnit', () => {
  it('is stable for a seed and a card, and differs between seeds', () => {
    expect(seededUnit(1, 'a')).toBe(seededUnit(1, 'a'))
    expect(seededUnit(1, 'a')).not.toBe(seededUnit(2, 'a'))
    const v = seededUnit(7, 'x'); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1)
  })
})

describe('spreadSiblings', () => {
  it('keeps cards of one product apart when possible', () => {
    const items = ['a', 'a', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => ({ id, i }))
    const out = spreadSiblings(items, (x) => x.id, 3)
    const positions = out.map((x, i) => (x.id === 'a' ? i : -1)).filter((i) => i >= 0)
    expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(4)
    expect(positions[2] - positions[1]).toBeGreaterThanOrEqual(4)
    expect(out).toHaveLength(items.length)
  })
  it('still returns everything when there is nothing else to put between them', () => {
    expect(spreadSiblings([{ id: 'a' }, { id: 'a' }], (x) => x.id)).toHaveLength(2)
  })
})

describe('feedOrder', () => {
  const items = [
    ...['red', 'green', 'blue'].map((c) => card('p1', c)),
    ...['red', 'green', 'blue'].map((c) => card('p2', c)),
    ...'abcdefghij'.split('').map((id) => card(id)),
  ]
  it('is stable for a seed and does not lose or duplicate a card', () => {
    const a = feedOrder(items, 42), b = feedOrder(items, 42)
    expect(a.map((c) => c.feed_key)).toEqual(b.map((c) => c.feed_key))
    expect(new Set(a.map((c) => c.feed_key)).size).toBe(items.length)
  })
  it('differs with another seed and never puts two cards of a product side by side', () => {
    expect(feedOrder(items, 1).map((c) => c.feed_key)).not.toEqual(feedOrder(items, 2).map((c) => c.feed_key))
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const out = feedOrder(items, seed)
      out.forEach((c, i) => { if (i > 0) expect(c.id).not.toBe(out[i - 1].id) })
    }
  })
  it('lets featured products come first more often than not', () => {
    const many = [...Array.from({ length: 20 }, (_, i) => card(`n${i}`)), card('star', null, true)]
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => feedOrder(many, seed).findIndex((c) => c.id === 'star'))
    expect(ranks.filter((r) => r < 10).length).toBeGreaterThanOrEqual(5)
  })
})
