import { describe, expect, it } from 'vitest'
import { allowedPlatform, nameFromUrl, parsePreview, safeImageUrl } from './parse'

describe('allowedPlatform', () => {
  it('accepts the three shops and their subdomains', () => {
    expect(allowedPlatform('https://www.alibaba.com/product-detail/x_1600123456789.html')?.platform).toBe('alibaba')
    expect(allowedPlatform('https://fr.shein.com/Robe-p-123-cat-1.html')?.platform).toBe('shein')
    expect(allowedPlatform('https://www.temu.com/-Chaussettes-g-601099512345678.html')?.platform).toBe('temu')
  })
  it('refuses look-alike hosts, http, credentials and ports', () => {
    for (const bad of [
      'https://alibaba.com.evil.io/x', 'https://notalibaba.com/x', 'http://www.temu.com/x',
      'https://user:pw@www.temu.com/x', 'https://www.temu.com:8443/x', 'https://127.0.0.1/x', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url',
    ]) expect(allowedPlatform(bad)).toBeNull()
  })
})

describe('safeImageUrl', () => {
  it('keeps public https images and resolves protocol-relative ones', () => {
    expect(safeImageUrl('//img.alicdn.com/a.jpg')).toBe('https://img.alicdn.com/a.jpg')
    expect(safeImageUrl('/a.jpg', 'https://www.temu.com/x')).toBe('https://www.temu.com/a.jpg')
  })
  it('blocks internal targets', () => {
    for (const bad of ['http://img.cdn.com/a.jpg', 'https://127.0.0.1/a.jpg', 'https://169.254.169.254/latest', 'https://localhost/a.jpg', 'https://db.internal/a', 'https://[::1]/a', 'https://host/a.jpg', 'https://u:p@img.cdn.com/a.jpg'])
      expect(safeImageUrl(bad)).toBeNull()
  })
})

describe('nameFromUrl', () => {
  it('reads a name from each shop URL pattern', () => {
    expect(nameFromUrl(new URL('https://www.alibaba.com/product-detail/Custom-sport-socks_1600123456789.html'))).toBe('Custom sport socks')
    expect(nameFromUrl(new URL('https://fr.shein.com/Floral-Summer-Dress-p-12345-cat-1727.html'))).toBe('Floral Summer Dress')
    expect(nameFromUrl(new URL('https://www.temu.com/-Men-s-Socks-g-601099512345678.html'))).toBe("Men s Socks")
  })
  it('returns null when the path says nothing', () => expect(nameFromUrl(new URL('https://www.temu.com/12345678'))).toBeNull())
})

describe('parsePreview', () => {
  const url = new URL('https://www.alibaba.com/product-detail/Custom-sport-socks_1600123456789.html')

  it('reads Open Graph tags and strips the site suffix', () => {
    const html = `<html><head><title>x</title>
      <meta property="og:title" content="Custom sport socks &amp; logo - Alibaba.com">
      <meta property="og:image" content="//sc04.alicdn.com/kf/abc.jpg">
      <meta property="product:price:amount" content="1.85"><meta property="product:price:currency" content="usd"></head></html>`
    expect(parsePreview(html, url)).toEqual({ name: 'Custom sport socks & logo', image: 'https://sc04.alicdn.com/kf/abc.jpg', price: 1.85, currency: 'USD' })
  })

  it('falls back to JSON-LD for the price', () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Boxy shirt","image":["https://img.cdn.com/s.jpg"],"offers":{"@type":"Offer","price":"12.50","priceCurrency":"USD"}}</script>`
    expect(parsePreview(html, url)).toEqual({ name: 'Boxy shirt', image: 'https://img.cdn.com/s.jpg', price: 12.5, currency: 'USD' })
  })

  it('still gives a name from the URL when the page has nothing usable', () => {
    expect(parsePreview('<html></html>', url)).toEqual({ name: 'Custom sport socks', image: null, price: null, currency: null })
  })

  it('never returns an unsafe image', () => {
    const html = '<meta property="og:image" content="https://169.254.169.254/latest/meta-data">'
    expect(parsePreview(html, url).image).toBeNull()
  })
})
