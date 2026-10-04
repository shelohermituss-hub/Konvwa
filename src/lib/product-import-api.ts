import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

export interface ImportedProduct {
  name: string
  name_en: string
  description: string
  description_en: string
  brand: string | null
  category: string | null
  tags: string[]
  tags_en: string[]
  images: string[]
  price_usd: number | null
  price_currency: string | null
  specifications: Record<string, string>
  rating: number | null
  review_count: number | null
  weight_kg: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  package_source: 'package' | 'item' | 'ai' | 'none'
  package_estimated: boolean
  source_url: string
  source_asin: string
  warnings: string[]
}

export interface ShippingOption {
  rate_id: string
  name: string
  mode: string
  transit_days_min: number | null
  transit_days_max: number | null
  amount_htg: number
  per_unit_htg: number
}

export interface ShippingEstimate {
  kg: number
  chargeable_kg: number
  cbm: number
  options: ShippingOption[]
}

/** Calls the admin-only `product-import` Edge Function (Amazon link -> product sheet data). */
export async function importProductFromLink(url: string): Promise<ImportedProduct> {
  const { data, error } = await supabase.functions.invoke('product-import', { body: { url } })
  if (error) {
    // a non-2xx answer carries the function's own message in the response body
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as { error?: string } | null : null
    throw new Error(body?.error || tr('Erreur réseau'))
  }
  if (data?.error) throw new Error(String(data.error))
  return data as ImportedProduct
}

/** Shipping cost per mode for a package (staff only, computed by the database with the shipping rates). */
export async function estimateShipping(args: {
  kg: number | null; length: number | null; width: number | null; height: number | null; qty: number; category: string
}): Promise<ShippingEstimate | null> {
  const { data, error } = await supabase.rpc('admin_product_shipping_estimate', {
    p_kg: args.kg, p_length: args.length, p_width: args.width, p_height: args.height, p_qty: args.qty, p_category_slug: args.category,
  })
  const res = data as ({ success: boolean; error?: string } & ShippingEstimate) | null
  if (error || !res?.success) return null
  return { kg: res.kg, chargeable_kg: res.chargeable_kg, cbm: res.cbm, options: res.options ?? [] }
}
