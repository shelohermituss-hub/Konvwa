import { describe, expect, it } from 'vitest'
import { normalizeVariants } from './variants'

const deps = {
  image: (raw: unknown) => (typeof raw === 'string' && raw.startsWith('https://ok/') ? raw : null),
  price: (p: unknown) => (typeof p === 'number' && p > 0 ? p : null),
}

describe('normalizeVariants', () => {
  it('keeps explicit variants with their own regular price and picture', () => {
    const { rows } = normalizeVariants({ variants: [
      { color: 'Black', size: 'M', price: 20, image: 'https://ok/black.jpg', in_stock: true },
      { name: 'Red / L', price: 22, image: 'https://evil/x.jpg', in_stock: false },
    ] }, deps)
    expect(rows).toEqual([
      { group_name: 'Couleur / Taille', label: 'Black / M', price_usd: 20, image: 'https://ok/black.jpg', in_stock: true },
      { group_name: null, label: 'Red / L', price_usd: 22, image: null, in_stock: false },
    ])
  })
  it('combines colours (picture) and sizes (price) when there are no explicit variants', () => {
    const { rows } = normalizeVariants({ colors: [{ name: 'Black', image: 'https://ok/b.jpg' }, { name: 'Red', image: 'https://ok/r.jpg' }], sizes: [{ name: 'S', price: 10 }, { name: 'M', price: 12 }] }, deps)
    expect(rows.map((r) => [r.label, r.price_usd, r.image])).toEqual([
      ['Black / S', 10, 'https://ok/b.jpg'], ['Black / M', 12, 'https://ok/b.jpg'], ['Red / S', 10, 'https://ok/r.jpg'], ['Red / M', 12, 'https://ok/r.jpg'],
    ])
  })
  it('handles a single dimension', () => {
    expect(normalizeVariants({ sizes: [{ name: 'XL' }] }, deps).rows).toEqual([{ group_name: 'Taille', label: 'XL', price_usd: null, image: null, in_stock: true }])
    expect(normalizeVariants({ colors: [{ name: 'Blue', image: 'https://ok/x.jpg' }] }, deps).rows[0].group_name).toBe('Couleur')
  })
  it('drops empty and duplicated labels and caps the list', () => {
    const many = Array.from({ length: 130 }, (_, i) => ({ name: `V${i}`, price: 5 }))
    const r = normalizeVariants({ variants: [{ name: '' }, { name: 'A' }, { name: 'a' }, ...many] }, deps)
    expect(r.rows).toHaveLength(100); expect(r.truncated).toBe(true); expect(r.rows[0].label).toBe('A')
  })
  it('ignores junk input', () => {
    expect(normalizeVariants({ variants: 'x', colors: null, sizes: [1, null] }, deps)).toEqual({ rows: [], truncated: false })
  })
})
