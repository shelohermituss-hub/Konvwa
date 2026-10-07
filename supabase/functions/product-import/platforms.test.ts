import { describe, expect, it } from 'vitest'
import { parseProductUrl, parseSharePrice, platformImageUrl, platformImages } from './platforms'

describe('parseProductUrl', () => {
  it('keeps Amazon working', () => {
    const t = parseProductUrl('https://www.amazon.com/Some-Name/dp/B08N5WRWNW?ref=x')
    expect(t?.platform.id).toBe('amazon'); expect(t?.id).toBe('B08N5WRWNW'); expect(t?.url).toBe('https://www.amazon.com/dp/B08N5WRWNW')
  })
  it('reads Shein, Alibaba, 1688, Temu and Muscle & Strength links', () => {
    expect(parseProductUrl('https://us.shein.com/Women-Dress-p-12345678-cat-1727.html?src=1')).toMatchObject({ platform: { id: 'shein', country: 'CN' }, id: '12345678', url: 'https://us.shein.com/Women-Dress-p-12345678-cat-1727.html' })
    expect(parseProductUrl('https://www.alibaba.com/product-detail/Bottle_1600123456789.html?spm=a2700')).toMatchObject({ platform: { id: 'alibaba' }, id: '1600123456789' })
    expect(parseProductUrl('https://detail.1688.com/offer/712345678901.html')).toMatchObject({ platform: { id: 'alibaba' }, id: '712345678901' })
    expect(parseProductUrl('https://www.temu.com/some-product-g-601099512345678.html?x=1')).toMatchObject({ platform: { id: 'temu' }, id: '601099512345678', url: 'https://www.temu.com/some-product-g-601099512345678.html' })
    expect(parseProductUrl('https://www.temu.com/goods.html?goods_id=601099512345678&utm=1')).toMatchObject({ id: '601099512345678', url: 'https://www.temu.com/goods.html?goods_id=601099512345678' })
    expect(parseProductUrl('https://www.muscleandstrength.com/store/optimum-nutrition-gold-standard-whey.html?utm=a')).toMatchObject({ platform: { id: 'muscle_strength', country: 'US' }, id: 'optimum-nutrition-gold-standard-whey', url: 'https://www.muscleandstrength.com/store/optimum-nutrition-gold-standard-whey.html' })
  })
  it('recognises app share links and the other Shein / Temu address shapes', () => {
    for (const link of ['https://shein.top/abc123', 'https://api-shein.shein.com/h5/sharejump/appjump?link=x', 'https://temu.to/k/abc', 'https://share.temu.com/Sc2wayeg0LC', 'https://app.temu.com/m/abc', 'https://onelink.shein.com/55/64940c8fv671?shc=2_Rk9dkrTPS2e']) {
      expect(parseProductUrl(link)).toMatchObject({ short: true, id: null })
    }
    expect(parseProductUrl('https://www.temu.com/fr/some-product-g-601099512345678.html?x=1')).toMatchObject({ platform: { id: 'temu' }, id: '601099512345678' })
    expect(parseProductUrl('https://fr.shein.com/Robe-p-12345678.html')).toMatchObject({ platform: { id: 'shein' }, id: '12345678' })
    expect(parseProductUrl('https://www.alibaba.com/x/B2XYex?ck=pdp')).toMatchObject({ platform: { id: 'alibaba' }, short: true, id: null, url: 'https://www.alibaba.com/x/B2XYex' })
    expect(parseProductUrl('https://www.alibaba.com/product-detail/Bottle_1600123456789.html')).toMatchObject({ id: '1600123456789' })
    expect(parseProductUrl('https://m.alibaba.com/product/1600123456789/Some-Name.html')).toMatchObject({ platform: { id: 'alibaba' }, id: '1600123456789' })
    expect(parseProductUrl('https://www.alibaba.com/product-detail/x.html?productId=1600123456789')).toMatchObject({ id: '1600123456789' })
    expect(parseProductUrl('https://temu.to.evil.test/k/abc')).toBeNull()
    expect(parseProductUrl('https://www.shein.top.evil.test/x')).toBeNull()
  })
  it('refuses look-alike hosts, http, credentials, ports and unknown sites', () => {
    for (const bad of [
      'https://shein.com.evil.test/x-p-1234567.html', 'https://evilshein.com/x-p-1234567.html', 'http://www.temu.com/x-g-601099512345678.html',
      'https://user:pw@www.temu.com/x-g-601099512345678.html', 'https://www.temu.com:8443/x-g-601099512345678.html',
      'https://alibaba.com.evil.test/product-detail/x_1600123456789.html', 'https://muscleandstrength.com.evil.test/store/x.html',
      'https://example.com/', 'not a url', 'https://169.254.169.254/latest',
    ]) expect(parseProductUrl(bad)).toBeNull()
  })
  it('flags a link that is not a product page with no id', () => {
    expect(parseProductUrl('https://www.shein.com/')?.id).toBeNull()
    expect(parseProductUrl('https://www.muscleandstrength.com/store/')?.id).toBeNull()
  })
})

describe('platformImageUrl', () => {
  it('accepts only the platform image hosts and strips thumbnail sizes', () => {
    expect(platformImageUrl('shein', '//img.ltwebstatic.com/images3_pi/2023/a_thumbnail_220x293.jpg')).toBe('https://img.ltwebstatic.com/images3_pi/2023/a.jpg')
    expect(platformImageUrl('alibaba', 'https://sc04.alicdn.com/kf/H1.jpg_220x220q90.jpg')).toBe('https://sc04.alicdn.com/kf/H1.jpg')
    expect(platformImageUrl('temu', 'https://img.kwcdn.com/product/open/abc.jpg?imageView2=2')).toBe('https://img.kwcdn.com/product/open/abc.jpg')
    expect(platformImageUrl('muscle_strength', 'https://www.muscleandstrength.com/sites/default/files/x.png')).toBe('https://www.muscleandstrength.com/sites/default/files/x.png')
  })
  it('refuses other hosts, other platforms, http and non images', () => {
    expect(platformImageUrl('shein', 'https://evil.test/a.jpg')).toBeNull()
    expect(platformImageUrl('shein', 'https://img.kwcdn.com/a.jpg')).toBeNull()
    expect(platformImageUrl('temu', 'http://img.kwcdn.com/a.jpg')).toBeNull()
    expect(platformImageUrl('temu', 'https://img.kwcdn.com.evil.test/a.jpg')).toBeNull()
    expect(platformImageUrl('temu', 'https://img.kwcdn.com/a.svg')).toBeNull()
    expect(platformImageUrl('alibaba', 42)).toBeNull()
  })
  it('lists distinct valid pictures up to the limit', () => {
    expect(platformImages('temu', ['https://img.kwcdn.com/a.jpg', 'https://img.kwcdn.com/a.jpg', 'https://evil.test/b.jpg', 'https://img.kwcdn.com/c.jpg'], 2)).toEqual(['https://img.kwcdn.com/a.jpg', 'https://img.kwcdn.com/c.jpg'])
  })
})

describe('Alibaba share page', () => {
  const link = 'https://www.alibaba.com/share/product-detail.html?from=share&productId=1600629956999&name=de+Leggings+Veste+3+Pi%C3%A8ces&price=8%2C80%C2%A0%24US&imageUrl=https%3A%2F%2Fs.alicdn.com%2F%40sc04%2Fkf%2FH0c418d.jpg_720x720Q50.jpg&moq=Min.+Ordre%3A+1+pi%C3%A8ce&companyInfo=6+ans+%C2%B7+CN+%C2%B7+Shenzhen+Co.&shortKey=B2XZTa&language=fr'
  it('reads the product id, the canonical page and the data carried by the address', () => {
    const t = parseProductUrl(link)
    expect(t).toMatchObject({ platform: { id: 'alibaba' }, id: '1600629956999', url: 'https://www.alibaba.com/product-detail/_1600629956999.html' })
    expect(t?.hint).toMatchObject({ name: 'de Leggings Veste 3 Pièces', price: 8.8, currency: 'USD', image: 'https://s.alicdn.com/@sc04/kf/H0c418d.jpg' })
    expect(t?.hint?.note).toContain('Shenzhen')
  })
  it('parses prices written in several ways', () => {
    expect(parseSharePrice('8,80\u00a0$US')).toEqual({ price: 8.8, currency: 'USD' })
    expect(parseSharePrice('US $12.50')).toEqual({ price: 12.5, currency: 'USD' })
    expect(parseSharePrice('€ 7,5')).toEqual({ price: 7.5, currency: 'EUR' })
    expect(parseSharePrice(null)).toEqual({ price: null, currency: 'USD' })
  })
})
