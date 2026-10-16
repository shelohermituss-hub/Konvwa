import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, discoverUrl, extractCandidates } from './discover.ts'

describe('discoverUrl', () => {
  it('builds the ranking address from the fixed lists only', () => {
    expect(discoverUrl('movers', 'electronics')).toBe('https://www.amazon.com/gp/movers-and-shakers/electronics')
    expect(discoverUrl('bestsellers', '')).toBe('https://www.amazon.com/gp/bestsellers')
    expect(discoverUrl('new', 'beauty')).toBe('https://www.amazon.com/gp/new-releases/beauty')
  })
  it('refuses anything else (no address typed by the user can be fetched)', () => {
    expect(discoverUrl('https://evil.example', 'beauty')).toBeNull()
    expect(discoverUrl('movers', '../../etc')).toBeNull()
    expect(discoverUrl('constructor', 'beauty')).toBeNull()
    expect(Object.keys(DEPARTMENTS).length).toBeGreaterThan(10)
  })
  it('builds Alibaba and Amazon searches from the fixed topics only', () => {
    expect(discoverUrl('alibaba', 'laptop')).toContain('SearchText=laptop')
    expect(discoverUrl('alibaba', 'anything else')).toBeNull()
    expect(discoverUrl('amazon_search', 'smartphone unlocked')).toBe('https://www.amazon.com/s?k=smartphone%20unlocked&rh=p_72%3A1248879011&s=exact-aware-popularity-rank')
    expect(discoverUrl('amazon_search', 'x&y=1')).toBeNull()
  })
})

describe('extractCandidates', () => {
  const links = [
    'https://www.amazon.com/Some-Product/dp/B0AAAAAAA1/ref=zg_bs_1?_encoding=UTF8',
    'https://www.amazon.com/Some-Product/dp/B0AAAAAAA1/ref=zg_bs_1',
    'https://www.amazon.com/Other/dp/B0BBBBBBB2',
    'https://www.amazon.com/gp/product/B0CCCCCCC3?psc=1',
    'https://www.amazon.com/gp/bestsellers/electronics',
    'https://www.amazon.com/Low/dp/B0DDDDDDD4',
    42,
  ]
  const markdown = [
    '#1 [![img](https://m.media-amazon.com/x.jpg)](https://www.amazon.com/Some-Product/dp/B0AAAAAAA1/ref=zg)',
    '[Great Wireless Earbuds with Case](https://www.amazon.com/Some-Product/dp/B0AAAAAAA1/ref=zg) 4.6 out of 5 stars 12,345 $24.99',
    '[Handy Kitchen Gadget Set](https://www.amazon.com/Other/dp/B0BBBBBBB2) 4.2 out of 5 stars 800 $9.50',
    '[Bad Product That Breaks](https://www.amazon.com/Low/dp/B0DDDDDDD4) 3.4 out of 5 stars 5,000 $12.00',
  ].join('\n')

  it('keeps one candidate per product, in page order, with an address without tracking', () => {
    const c = extractCandidates(links, markdown)
    expect(c.map((x) => x.asin)).toEqual(['B0AAAAAAA1', 'B0BBBBBBB2', 'B0CCCCCCC3'])
    expect(c[0].url).toBe('https://www.amazon.com/dp/B0AAAAAAA1')
    expect(c.map((x) => x.rank)).toEqual([1, 2, 3])
  })

  it('reads title, stars, ratings and price next to the product', () => {
    const [a, b] = extractCandidates(links, markdown)
    expect(a).toMatchObject({ title: 'Great Wireless Earbuds with Case', rating: 4.6, reviews: 12345, price_usd: 24.99 })
    expect(b).toMatchObject({ title: 'Handy Kitchen Gadget Set', rating: 4.2, reviews: 800, price_usd: 9.5 })
  })

  it('drops products rated below 4 stars but keeps those whose rating is unknown', () => {
    const c = extractCandidates(links, markdown)
    expect(c.find((x) => x.asin === 'B0DDDDDDD4')).toBeUndefined()
    expect(c.find((x) => x.asin === 'B0CCCCCCC3')).toMatchObject({ rating: null, title: null })
  })

  it('reads the picture next to the product and fills gaps from the structured list', () => {
    const md = '[![Earbuds pic](https://m.media-amazon.com/images/I/aaa.jpg)](https://www.amazon.com/x/dp/B0AAAAAAA1)'
    const [a, b] = extractCandidates(
      ['https://www.amazon.com/x/dp/B0AAAAAAA1', 'https://www.amazon.com/y/dp/B0BBBBBBB2'], md, 60,
      [{ url: 'https://www.amazon.com/y/dp/B0BBBBBBB2', title: 'Structured Title Product', image_url: '//m.media-amazon.com/images/I/bbb.jpg', price_usd: 12.5, rating: 4.4, reviews: 99 }],
    )
    expect(a.image).toBe('https://m.media-amazon.com/images/I/aaa.jpg')
    expect(a.title).toBe('Earbuds pic')
    expect(b).toMatchObject({ title: 'Structured Title Product', image: 'https://m.media-amazon.com/images/I/bbb.jpg', price_usd: 12.5, rating: 4.4, reviews: 99 })
  })

  it('understands Alibaba product pages', () => {
    const [c] = extractCandidates(['https://www.alibaba.com/product-detail/Cool-Lamp_1600123456789.html?spm=a'], '', 60, [])
    expect(c).toMatchObject({ platform: 'alibaba', asin: '1600123456789', url: 'https://www.alibaba.com/product-detail/Cool-Lamp_1600123456789.html' })
  })

  it('survives a page without usable data', () => {
    expect(extractCandidates(undefined, undefined)).toEqual([])
    expect(extractCandidates(['https://www.amazon.com/x'], '')).toEqual([])
  })
})
