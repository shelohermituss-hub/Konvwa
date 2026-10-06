import { describe, expect, it } from 'vitest'
import { withSponsored } from './sponsored'

const kinds = (n: number, ads: string[]) => withSponsored(Array.from({ length: n }, (_, i) => i), ads, 4, 2).map((e) => (e.kind === 'ad' ? `ad:${e.ad}` : String(e.item)))

describe('withSponsored', () => {
  it('puts an ad before the 3rd product, then every 4 products, each ad only once', () => {
    expect(kinds(11, ['A', 'B'])).toEqual(['0', '1', 'ad:A', '2', '3', '4', '5', 'ad:B', '6', '7', '8', '9', '10'])
    expect(kinds(20, ['A']).filter((k) => k === 'ad:A')).toHaveLength(1)
  })
  it('adds nothing without ads or before the first slot', () => {
    expect(kinds(5, [])).toEqual(['0', '1', '2', '3', '4'])
    expect(kinds(2, ['A'])).toEqual(['0', '1'])
  })
  it('keeps the earlier entries unchanged when more products are loaded', () => {
    const a = kinds(8, ['A', 'B']); const b = kinds(14, ['A', 'B'])
    expect(b.slice(0, a.length)).toEqual(a)
  })
})
