import { describe, expect, it } from 'vitest'
import { amazonImageUrl, canonicalUrl, parseAmazonUrl, pickImages } from './amazon'

describe('parseAmazonUrl', () => {
  it('accepts marketplaces and extracts the ASIN', () => {
    expect(parseAmazonUrl('https://www.amazon.com/Some-Product-Name/dp/B08N5WRWNW/ref=sr_1_1?keywords=x')).toMatchObject({ domain: 'amazon.com', asin: 'B08N5WRWNW', short: false })
    expect(parseAmazonUrl('https://amazon.fr/gp/product/b08n5wrwnw')?.asin).toBe('B08N5WRWNW')
    expect(parseAmazonUrl('https://www.amazon.co.uk/dp/B08N5WRWNW')?.domain).toBe('amazon.co.uk')
    expect(parseAmazonUrl('https://smile.amazon.com/dp/B08N5WRWNW')?.domain).toBe('amazon.com')
    expect(parseAmazonUrl('https://m.amazon.com/gp/aw/d/B08N5WRWNW')?.asin).toBe('B08N5WRWNW')
  })
  it('accepts short links (resolved later) and keeps ASIN null when absent', () => {
    expect(parseAmazonUrl('https://a.co/d/abc123')).toMatchObject({ short: true, asin: null })
    expect(parseAmazonUrl('https://amzn.to/3xyz')?.short).toBe(true)
    expect(parseAmazonUrl('https://www.amazon.com/s?k=shoes')?.asin).toBeNull()
  })
  it('refuses look-alike hosts, http, credentials and ports', () => {
    expect(parseAmazonUrl('https://amazon.com.evil.com/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://evil-amazon.com/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://amazon.com@evil.com/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('http://www.amazon.com/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://user:pw@www.amazon.com/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://www.amazon.com:8443/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://www.amazon.cn/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('https://169.254.169.254/dp/B08N5WRWNW')).toBeNull()
    expect(parseAmazonUrl('javascript:alert(1)')).toBeNull()
    expect(parseAmazonUrl('not a url')).toBeNull()
  })
  it('builds a tracking-free canonical URL', () => {
    expect(canonicalUrl('amazon.com', 'B08N5WRWNW')).toBe('https://www.amazon.com/dp/B08N5WRWNW')
  })
})

describe('amazon images', () => {
  it('keeps only Amazon CDN images and removes size modifiers', () => {
    expect(amazonImageUrl('https://m.media-amazon.com/images/I/71abcDEF._AC_SL1500_.jpg')).toBe('https://m.media-amazon.com/images/I/71abcDEF.jpg')
    expect(amazonImageUrl('https://m.media-amazon.com/images/I/41x._AC_US40_.png?foo=1')).toBe('https://m.media-amazon.com/images/I/41x.png')
    expect(amazonImageUrl('https://images-na.ssl-images-amazon.com/images/I/a.jpg')).toBe('https://images-na.ssl-images-amazon.com/images/I/a.jpg')
  })
  it('refuses other hosts, http, IPs, ports, other types', () => {
    expect(amazonImageUrl('https://evil.com/images/I/a.jpg')).toBeNull()
    expect(amazonImageUrl('https://m.media-amazon.com.evil.com/a.jpg')).toBeNull()
    expect(amazonImageUrl('http://m.media-amazon.com/images/I/a.jpg')).toBeNull()
    expect(amazonImageUrl('https://m.media-amazon.com:444/images/I/a.jpg')).toBeNull()
    expect(amazonImageUrl('https://m.media-amazon.com/images/I/a.svg')).toBeNull()
    expect(amazonImageUrl(null)).toBeNull()
  })
  it('dedupes and limits', () => {
    const list = Array.from({ length: 9 }, (_, i) => `https://m.media-amazon.com/images/I/${i % 7}.jpg`)
    expect(pickImages(list, 5)).toHaveLength(5)
    expect(pickImages(['https://m.media-amazon.com/images/I/a.jpg', 'https://m.media-amazon.com/images/I/a._AC_SL500_.jpg'])).toHaveLength(1)
    expect(pickImages('nope')).toEqual([])
  })
})
