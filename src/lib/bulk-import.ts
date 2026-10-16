import { supabase } from '@/lib/supabase'
import { importDefaults, priceHtgFromUsd } from '@/lib/import-pricing'
import { importProductFromLink, type ImportedProduct } from '@/lib/product-import-api'
import { tr } from '@/lib/i18n'

export interface ImportRates { rate: number; margin: number }

/** Exchange rate and service margin the shop prices imports with (same settings as the single-link import). */
export async function loadImportRates(): Promise<ImportRates> {
  const { data } = await supabase.from('app_settings').select('key, value').in('key', ['usd_to_htg_rate', 'service_margin_percent'])
  const get = (k: string, fallback: number) => { const v = Number(data?.find((r: { key: string; value: string }) => r.key === k)?.value); return Number.isFinite(v) && v > 0 ? v : fallback }
  return { rate: get('usd_to_htg_rate', 140), margin: get('service_margin_percent', 15) }
}

/** The `products` row of an imported product: same mapping as the single-link import form, created hidden (a draft to review, then publish). */
export function importedToRow(d: ImportedProduct, { rate, margin }: ImportRates) {
  return {
    name: d.name,
    description: d.description,
    name_en: d.name_en || null,
    description_en: d.description_en || null,
    price_htg: d.price_usd ? priceHtgFromUsd(d.price_usd, rate, margin) : 0,
    discount_pct: d.discount_pct ?? null,
    moq: d.moq ?? 1,
    unit: tr('unité'),
    price_tiers: (d.price_tiers ?? []).map((t) => ({ min_qty: t.min_qty, price_htg: priceHtgFromUsd(t.price_usd, rate, margin) })),
    category: d.category ?? null,
    shipping_item_type: d.shipping_item_type ?? null,
    supplier_name: d.supplier_name,
    supplier_country: d.supplier_country,
    ...importDefaults(d.supplier_country),
    images: d.images,
    video_url: d.video_url ?? null,
    specifications: d.specifications,
    tags: d.tags, tags_en: d.tags_en,
    rating: d.rating,
    review_count: d.review_count ?? 0,
    weight_kg: d.weight_kg, length_cm: d.length_cm, width_cm: d.width_cm, height_cm: d.height_cm,
    package_estimated: d.package_estimated,
    brand: d.brand, source_url: d.source_url, source_asin: d.source_asin,
    source_price_usd: d.price_usd,
    sale_type: d.platform === 'alibaba' ? 'wholesale' : 'retail',
    active: false,
  }
}

/** Reads one Amazon product page and saves it as a hidden product with its variants and reviews. Returns the new product id. */
export async function importAndSave(url: string, rates: ImportRates): Promise<{ id: string; name: string }> {
  const d = await importProductFromLink(url)
  if (!d.images.length) throw new Error(tr('Aucune photo exploitable'))
  const { data, error } = await supabase.from('products').insert(importedToRow(d, rates)).select('id').single()
  if (error || !data) throw new Error(error?.message ?? tr('Erreur inconnue'))
  const id = data.id as string
  if (d.variants.length > 0) {
    const variants = d.variants.map((v, i) => ({
      id: null, group_name: v.group_name, label: v.label, label_en: v.label_en,
      price_htg: v.price_usd ? priceHtgFromUsd(v.price_usd, rates.rate, rates.margin) : priceHtgFromUsd(d.price_usd ?? 0, rates.rate, rates.margin),
      image: v.image, stock_available: v.stock_available, active: true, sort_order: i,
    })).filter((v) => v.price_htg > 0)
    if (variants.length > 0) await supabase.rpc('admin_save_product_variants', { p_product: id, p_variants: variants })
  }
  if (d.reviews?.length > 0) await supabase.rpc('admin_save_imported_reviews', { p_product: id, p_source: d.platform, p_source_url: d.source_url, p_reviews: d.reviews })
  return { id, name: d.name }
}

/** Runs `task` on every item with at most `limit` running at once; `onDone` is called as each one ends. */
export async function runPool<T>(items: T[], limit: number, task: (item: T, index: number) => Promise<void>, shouldStop: () => boolean): Promise<void> {
  let next = 0
  const worker = async () => {
    while (!shouldStop()) {
      const i = next++
      if (i >= items.length) return
      await task(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}
