import { describe, expect, it } from 'vitest'
import { normalizeReviews } from './reviews'

describe('normalizeReviews', () => {
  it('keeps well-formed reviews', () => {
    expect(normalizeReviews([{ author: 'Jean', rating: 5, title: 'Great', text: 'Tastes good', date: '2026-03-02' }])).toEqual([
      { author: 'Jean', rating: 5, title: 'Great', text: 'Tastes good', date: '2026-03-02' },
    ])
  })
  it('drops bad ratings, empty reviews and duplicates', () => {
    const out = normalizeReviews([
      { author: 'A', rating: 0, text: 'x' }, { author: 'B', rating: 6, text: 'x' }, { author: 'C', rating: 4 },
      { author: 'D', rating: 4, text: 'ok' }, { author: 'd', rating: 4, text: 'OK' },
    ])
    expect(out.map((r) => r.author)).toEqual(['D'])
  })
  it('strips markup, caps lengths, defaults the author', () => {
    const [r] = normalizeReviews([{ rating: 3.6, text: '<b>nice</b> ' + 'a'.repeat(3000) }])
    expect(r.author).toBe('Client')
    expect(r.rating).toBe(4)
    expect(r.text.startsWith('nice')).toBe(true)
    expect(r.text.length).toBe(1500)
  })
  it('ignores future and invalid dates, and caps the list at 20', () => {
    expect(normalizeReviews([{ rating: 5, text: 'a', date: '2999-01-01' }])[0].date).toBeNull()
    expect(normalizeReviews([{ rating: 5, text: 'a', date: 'yesterday' }])[0].date).toBeNull()
    expect(normalizeReviews(Array.from({ length: 50 }, (_, i) => ({ rating: 5, text: `r${i}` })))).toHaveLength(20)
    expect(normalizeReviews('nope')).toEqual([])
  })
})
