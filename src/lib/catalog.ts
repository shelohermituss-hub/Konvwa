import { LANG } from '@/lib/i18n'

export interface CatalogProduct {
  id: string
  name: string
  description: string | null
  price_htg: number
  price_tiers: unknown
  moq: number
  unit: string
  supplier_name: string | null
  supplier_verified: boolean
  supplier_years: number | null
  supplier_country: string | null
  category: string | null
  delivery_days_min: number | null
  delivery_days_max: number | null
  processing_days: number | null
  images: string[]
  specifications: Record<string, string> | null
  video_url?: string | null
  stock_available: boolean
  featured: boolean
  sold_count: number
  rating: number | null
  review_count: number
  repurchase_rate: number | null
  customization_options: string[]
  tags: string[]
  certifications: string[]
  name_en: string | null
  description_en: string | null
  tags_en: string[]
  customization_options_en: string[]
  certifications_en: string[]
  reseller_discount_pct?: number
  wholesale_only?: boolean
  /** 'retail': finished product sold by the unit; 'wholesale': sourcing sold in bulk with a minimum order quantity. */
  sale_type?: 'retail' | 'wholesale'
  reseller_price?: boolean
  product_variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  label: string
  label_en: string | null
  group_name: string | null
  price_htg: number
  image: string | null
  stock_available: boolean
  sort_order: number
}

export const VARIANT_SELECT = 'id, label, label_en, group_name, price_htg, image, stock_available, sort_order'

/** Label shown to the customer, in the current language. */
export function variantLabel(v: Pick<ProductVariant, 'label' | 'label_en'>): string {
  return LANG === 'en' && v.label_en?.trim() ? v.label_en : v.label
}

/** The variants of a product as returned by the catalogue embed: ordered, with numeric prices. */
export function sortVariants(list: ProductVariant[] | null | undefined): ProductVariant[] {
  return (list ?? [])
    .map((v) => ({ ...v, price_htg: Number(v.price_htg) }))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export const CATALOG_LIST_SELECT =
  'id, name, description, price_htg, price_tiers, moq, unit, supplier_name, supplier_verified, supplier_years, supplier_country, category, delivery_days_min, delivery_days_max, processing_days, images, stock_available, featured, sold_count, rating, review_count, repurchase_rate, customization_options, tags, certifications, name_en, description_en, tags_en, customization_options_en, certifications_en, reseller_discount_pct, wholesale_only, sale_type'

/** In English, shows the English content the admin wrote (field by field, falling back to the original). */
export function localizeProduct<T extends CatalogProduct>(p: T): T {
  if (LANG !== 'en') return p
  const pick = (original: string[], english: string[] | null | undefined) => (english && english.length > 0 ? english : original)
  return {
    ...p,
    name: p.name_en?.trim() || p.name,
    description: p.description_en?.trim() || p.description,
    tags: pick(p.tags ?? [], p.tags_en),
    customization_options: pick(p.customization_options ?? [], p.customization_options_en),
    certifications: pick(p.certifications ?? [], p.certifications_en),
  }
}

/** Reseller price (display only: the order function applies the same discount in the database). */
export function resellerPriced<T extends { price_htg: number; price_tiers?: unknown; reseller_discount_pct?: number }>(p: T, isReseller: boolean): T & { reseller_price?: boolean } {
  const pct = p.reseller_discount_pct ?? 0
  if (!isReseller || pct <= 0) return p
  const factor = 1 - pct / 100
  const tiers = Array.isArray(p.price_tiers)
    ? p.price_tiers.map((t) => ({ ...(t as object), price_htg: Math.round(Number((t as { price_htg: number }).price_htg) * factor * 100) / 100 }))
    : p.price_tiers
  return { ...p, price_htg: Math.round(p.price_htg * factor * 100) / 100, price_tiers: tiers, reseller_price: true }
}

export const CATALOG_DETAIL_SELECT = `${CATALOG_LIST_SELECT}, specifications, video_url, product_variants(${VARIANT_SELECT})`
