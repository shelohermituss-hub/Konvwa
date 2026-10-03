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
}

export const CATALOG_LIST_SELECT =
  'id, name, description, price_htg, price_tiers, moq, unit, supplier_name, supplier_verified, supplier_years, supplier_country, category, delivery_days_min, delivery_days_max, processing_days, images, stock_available, featured, sold_count, rating, review_count, repurchase_rate, customization_options, tags, certifications, name_en, description_en, tags_en, customization_options_en, certifications_en'

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

export const CATALOG_DETAIL_SELECT = `${CATALOG_LIST_SELECT}, specifications`
