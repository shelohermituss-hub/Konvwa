import { describe, expect, it } from 'vitest'
import { analyzeCatalogue, isImageUrl, siteOf, suggestCategory, type HealthProduct, type HealthVariant } from './product-health'

const product = (over: Partial<HealthProduct> = {}): HealthProduct => ({
  id: 'p1', name: 'Casque Bluetooth sans fil', price_htg: 2500, moq: 1, images: ['https://img.alicdn.com/a.jpg'], category: 'Audio', description: 'Un casque.', active: true,
  price_tiers: [], weight_kg: 0.4, created_at: '2026-01-01T00:00:00Z', ...over,
})
const variant = (over: Partial<HealthVariant> = {}): HealthVariant => ({ id: 'v1', product_id: 'p1', label: 'Noir', group_name: 'Couleur', image: 'https://img.alicdn.com/n.jpg', price_htg: 2500, ...over })
const codes = (p: HealthProduct[], v: HealthVariant[] = [], broken: string[] = []) => analyzeCatalogue(p, v, { broken: new Set(broken) }).map((i) => i.code)

describe('image links', () => {
  it('accepts https links without spaces only', () => {
    expect(isImageUrl('https://a.com/x.jpg')).toBe(true)
    expect(isImageUrl('http://a.com/x.jpg')).toBe(false)
    expect(isImageUrl('//a.com/x.jpg')).toBe(false)
    expect(isImageUrl('/images/x.jpg')).toBe(true)
    expect(isImageUrl('https://a.com/x y.jpg')).toBe(false)
    expect(isImageUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isImageUrl('')).toBe(false)
    expect(isImageUrl(null)).toBe(false)
  })
  it('knows the site of a link without its subdomain', () => {
    expect(siteOf('https://sc04.alicdn.com/kf/a.jpg')).toBe('alicdn.com')
    expect(siteOf('not a url')).toBe('')
  })
})

describe('analyzeCatalogue', () => {
  it('finds nothing wrong with a complete product', () => {
    expect(codes([product()], [variant()])).toEqual([])
  })

  it('flags an active product without any usable picture and proposes to switch it off', () => {
    const issues = analyzeCatalogue([product({ images: [] })], [])
    expect(issues[0]).toMatchObject({ code: 'no_image', severity: 'error', fix: { kind: 'deactivate' } })
    expect(codes([product({ images: [], active: false })])).not.toContain('no_image')
  })

  it('proposes to clean the unusable links and the repeated ones', () => {
    const issues = analyzeCatalogue([product({ images: ['https://img.alicdn.com/a.jpg', 'http://x.com/b.jpg', 'https://img.alicdn.com/a.jpg', ' '] })], [])
    const bad = issues.find((i) => i.code === 'bad_image_url')
    expect(bad?.fix).toEqual({ kind: 'set_images', images: ['https://img.alicdn.com/a.jpg'] })
  })

  it('removes the pictures that do not open and keeps the others; none left: the product is switched off', () => {
    const two = product({ images: ['https://img.alicdn.com/a.jpg', 'https://img.alicdn.com/b.jpg'] })
    const a = analyzeCatalogue([two], [], { broken: new Set(['https://img.alicdn.com/a.jpg']) })
    expect(a.find((i) => i.code === 'broken_image')?.fix).toEqual({ kind: 'set_images', images: ['https://img.alicdn.com/b.jpg'] })
    expect(a.some((i) => i.code === 'no_image')).toBe(false)
    const all = analyzeCatalogue([two], [], { broken: new Set(two.images) })
    expect(all.find((i) => i.code === 'broken_image')?.fix).toEqual({ kind: 'deactivate' })
    expect(all.some((i) => i.code === 'no_image')).toBe(true)
  })

  it('flags a missing or zero price', () => {
    expect(codes([product({ price_htg: 0 })])).toContain('no_price')
  })

  it('finds duplicates (same name, or same supplier page) and keeps the best one', () => {
    const a = product({ id: 'a', name: 'Casque Bluetooth  sans fil!', created_at: '2026-02-01T00:00:00Z' })
    const b = product({ id: 'b', created_at: '2026-01-01T00:00:00Z' })
    const issues = analyzeCatalogue([a, b], [])
    expect(issues.filter((i) => i.code === 'duplicate').map((i) => i.productId)).toEqual(['a'])
    const u1 = product({ id: 'u1', name: 'Montre A', source_url: 'https://www.shein.com/x-p-1.html?src=1' })
    const u2 = product({ id: 'u2', name: 'Montre B', source_url: 'https://www.shein.com/x-p-1.html?src=2', images: [] })
    expect(analyzeCatalogue([u1, u2], []).filter((i) => i.code === 'duplicate').map((i) => i.productId)).toEqual(['u2'])
  })

  it('flags variants that share a picture although they are different choices', () => {
    const vs = [variant({ id: 'v1', label: 'Noir', image: 'https://img.alicdn.com/same.jpg' }), variant({ id: 'v2', label: 'Rouge', image: 'https://img.alicdn.com/same.jpg' }), variant({ id: 'v3', label: 'Bleu' })]
    const issue = analyzeCatalogue([product()], vs).find((i) => i.code === 'variant_same_image')
    expect(issue?.fix).toEqual({ kind: 'clear_variant_images', variantIds: ['v2'] })
    // the same label twice (a size in two groups) is not suspicious
    expect(codes([product()], [variant({ id: 'v1', label: 'M', image: 'https://img.alicdn.com/s.jpg' }), variant({ id: 'v2', label: 'M', image: 'https://img.alicdn.com/s.jpg' })])).not.toContain('variant_same_image')
  })

  it('flags a variant picture from another site than the product pictures, and a variant picture that does not open', () => {
    const vs = [variant({ id: 'v1', image: 'https://cdn.other.com/x.jpg' }), variant({ id: 'v2', label: 'Rouge', image: 'https://img.alicdn.com/r.jpg' })]
    const issues = analyzeCatalogue([product()], vs, { broken: new Set(['https://img.alicdn.com/r.jpg']) })
    expect(issues.find((i) => i.code === 'variant_foreign_image')?.fix).toEqual({ kind: 'clear_variant_images', variantIds: ['v1'] })
    expect(issues.find((i) => i.code === 'variant_broken_image')?.fix).toEqual({ kind: 'clear_variant_images', variantIds: ['v2'] })
  })

  it('flags variants without a price, and malformed or useless price tiers', () => {
    expect(codes([product()], [variant({ price_htg: 0 })])).toContain('variant_no_price')
    const p = product({ moq: 10, price_tiers: [{ min_qty: 5, price_htg: 2000 }, { min_qty: 20, price_htg: 2000 }, { min_qty: 50, price_htg: 3000 }, { min_qty: 'x', price_htg: 1 }] })
    const t = analyzeCatalogue([p], []).find((i) => i.code === 'tiers')
    expect(t?.fix).toEqual({ kind: 'set_tiers', tiers: [{ min_qty: 20, price_htg: 2000 }] })
  })

  it('reports the missing category, description and weight as lighter issues', () => {
    const issues = analyzeCatalogue([product({ category: null, description: '', weight_kg: null })], [])
    expect(issues.map((i) => i.code).sort()).toEqual(['no_category', 'no_description', 'no_weight'])
    expect(issues.find((i) => i.code === 'no_category')?.severity).toBe('warning')
  })

  it('puts errors before warnings and warnings before information', () => {
    const issues = analyzeCatalogue([product({ id: 'x', images: [], category: null, description: null })], [])
    const sev = issues.map((i) => i.severity)
    expect(sev).toEqual([...sev].sort((a, b) => ['error', 'warning', 'info'].indexOf(a) - ['error', 'warning', 'info'].indexOf(b)))
  })
})

describe('suggestCategory', () => {
  const cat = [
    { name: 'Casque audio pro', category: 'Audio' }, { name: 'Casque gamer', category: 'Audio' }, { name: 'Enceinte portable', category: 'Audio' },
    { name: 'Montre connectée', category: 'Montres' }, { name: 'Montre homme acier', category: 'Montres' },
  ]
  it('suggests the category its words are tied to', () => {
    expect(suggestCategory('Casque sans fil', cat)).toBe('Audio')
    expect(suggestCategory('Montre sport', cat)).toBe('Montres')
  })
  it('suggests nothing when the words are unknown or ambiguous', () => {
    expect(suggestCategory('Brosse à dents', cat)).toBeNull()
    expect(suggestCategory('Casque montre', cat)).toBeNull()
  })
})
