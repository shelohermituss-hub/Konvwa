import { vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
import { describe, expect, it } from 'vitest'
import { importedToRow, runPool } from './bulk-import'
import type { ImportedProduct } from './product-import-api'

const base = {
  name: 'Écouteurs', name_en: 'Earbuds', description: 'd', description_en: 'de', tags: ['a'], tags_en: ['b'], images: ['https://x/y.jpg'], video_url: null,
  price_usd: 20, price_currency: 'USD', moq: null, price_tiers: [], specifications: {}, rating: 4.5, review_count: 10,
  weight_kg: 0.2, length_cm: 10, width_cm: 5, height_cm: 3, package_source: 'ai', package_estimated: true, source_url: 'https://www.amazon.com/dp/B0AAAAAAA1',
  source_asin: 'B0AAAAAAA1', platform: 'amazon', supplier_name: 'Amazon', supplier_country: 'US', variants: [], reviews: [], warnings: [], brand: null, category: null, discount_pct: 30,
} as unknown as ImportedProduct

describe('importedToRow', () => {
  it('creates a hidden product priced with the shop rate and margin', () => {
    const row = importedToRow(base, { rate: 140, margin: 15 })
    expect(row.active).toBe(false)
    expect(row.price_htg).toBe(3220)
    expect(row.source_asin).toBe('B0AAAAAAA1')
    expect(row.sale_type).toBe('retail')
    expect(row.discount_pct).toBe(30)
  })
})

describe('runPool', () => {
  it('runs everything with a bounded concurrency', async () => {
    let running = 0, peak = 0
    const done: number[] = []
    await runPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      running++; peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--; done.push(n)
    }, () => false)
    expect(done.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(peak).toBeLessThanOrEqual(3)
  })
  it('stops taking new items once asked to', async () => {
    const done: number[] = []
    let stop = false
    await runPool([1, 2, 3, 4, 5, 6], 1, async (n) => { done.push(n); if (n === 2) stop = true }, () => stop)
    expect(done).toEqual([1, 2])
  })
})
