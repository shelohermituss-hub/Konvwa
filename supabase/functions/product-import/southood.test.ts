import { describe, expect, it } from 'vitest'
import { discountFrom, extractBcpo, parseShopifyProduct, southoodGroups, southoodImage } from './southood.ts'

const html = `<script>var bcpo_data={"virtual_options":[{"title":"Lens type","values":[{"key":"Anti-blue Light","price":"19.99"},{"key":"Tinted"},{"key":"🔥Photochromic"},{"key":"Anti-blue+Photochromic","price":"0"}]},
{"title":"Reading Glasses","values":[{"key":"+50"},{"key":"+75"},{"key":"?"}]},
{"title":"📦<font>Frequently Bought Together","multiselect":"on","values":[{"key":"Rose red","value":"https://d17fzo7x83uajt.cloudfront.net/abc"},{"key":"Black","value":"https://evil.example/x"}]}]};var other = {a:1};</script>`

describe('southood', () => {
  it('reads the options object out of the page', () => {
    expect(extractBcpo(html)?.virtual_options).toHaveLength(3)
    expect(extractBcpo('<html></html>')).toBeNull()
  })

  it('keeps the three lenses, the power and the cases at KONVWA prices', () => {
    const g = southoodGroups(extractBcpo(html))
    expect(g.map((x) => x.name)).toEqual(['Verres', 'Puissance du verre', 'Étui'])
    expect(g[0].options.map((o) => o.price_usd)).toEqual([19.99, 49.99, 89.99])
    expect(g[1]).toMatchObject({ show_when: 0, required: false })
    expect(g[1].options.map((o) => o.label)).toEqual(['+50', '+75'])
    expect(g[1].options.every((o) => o.price_usd === 5.99)).toBe(true)
    expect(g[2].multi).toBe(true)
    expect(g[2].options).toEqual([
      { label: 'Rose', label_en: 'Rose red', image: 'https://d17fzo7x83uajt.cloudfront.net/abc', price_usd: 9.99 },
      { label: 'Noir', label_en: 'Black', image: null, price_usd: 9.99 },
    ])
  })

  it('has no groups when the page has no options app', () => {
    expect(southoodGroups(null)).toEqual([])
  })

  it('reads variants, pictures and the struck price of the product JSON', () => {
    const p = parseShopifyProduct({
      options: [{ name: 'Frame Color' }],
      images: ['//cdn.shopify.com/s/files/a.jpg', 'https://other.example/b.jpg'],
      variants: [
        { option1: 'Leopard', price: 3995, compare_at_price: 7995, available: true, featured_image: { src: 'https://cdn.shopify.com/s/files/l.jpg' } },
        { option1: 'Black', price: 3995, compare_at_price: 7995, available: false, featured_image: null },
        { option1: 'Black', price: 3995 },
      ],
    })
    expect(p.variants).toEqual([
      { group_name: 'Frame Color', label: 'Leopard', price_usd: 39.95, image: 'https://cdn.shopify.com/s/files/l.jpg', in_stock: true },
      { group_name: 'Frame Color', label: 'Black', price_usd: 39.95, image: null, in_stock: false },
    ])
    expect(p.images).toEqual(['https://cdn.shopify.com/s/files/a.jpg'])
    expect(discountFrom(p.price_usd, p.compare_usd)).toBe(50)
  })

  it('refuses pictures from other hosts and tiny discounts', () => {
    expect(southoodImage('http://cdn.shopify.com/a.jpg')).toBeNull()
    expect(discountFrom(39.95, 40)).toBeNull()
    expect(discountFrom(null, 10)).toBeNull()
  })
})
