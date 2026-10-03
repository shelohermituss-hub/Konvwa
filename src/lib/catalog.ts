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
}

export const CATALOG_LIST_SELECT =
  'id, name, description, price_htg, price_tiers, moq, unit, supplier_name, supplier_verified, supplier_years, supplier_country, category, delivery_days_min, delivery_days_max, processing_days, images, stock_available, featured, sold_count, rating, review_count, repurchase_rate, customization_options, tags, certifications'

export const CATALOG_DETAIL_SELECT = `${CATALOG_LIST_SELECT}, specifications`
